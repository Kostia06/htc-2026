import type { Env } from "../env";
import { withLiveTips } from "./coach/report";
import { askForDebrief, buildDebrief, type Debrief, normalizeDebrief } from "./debrief";
import { withInterest } from "./interest";
import { claimDraftBuild, clearDraftWanted, dropDraftBuild, markDraftWanted, readDraft, releaseDraftBuild, saveDraft } from "./draft-store";
import { listTurns, type StoredTurn, type VoiceSession } from "./store";

// a burst of answers during one rebuild costs one more round, so this only stops a pathological loop
const MAX_ROUNDS = 3;
export const draftTiming = { waitMs: 4000, pollMs: 150 };

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// drafts are rebuilt after every answer, so they go to the cheaper lite model; the main one is its fallback
const liteModel = (env: Env): Env => ({ ...env, GEMINI_MODEL: env.GEMINI_FALLBACK_MODEL ?? env.GEMINI_MODEL, GEMINI_FALLBACK_MODEL: env.GEMINI_MODEL });

async function rebuildOnce(env: Env, userId: string, session: VoiceSession) {
  // cleared before reading, so a turn stored after this point marks it again and earns another round
  await clearDraftWanted(env, userId, session.id);
  const turns = await listTurns(env, userId, session.id);
  try {
    await saveDraft(env, userId, session.id, await askForDebrief(liteModel(env), session.plan, turns), turns.length);
  } catch (error) {
    // no scores-only stand-in: /finish would rather build the real report than show a weaker one
    console.warn("voice draft report failed:", error instanceof Error ? error.message : error);
  }
}

/** Rebuilds the session's draft report over every turn so far. At most one model call runs per session at a time. */
export async function refreshDraft(env: Env, userId: string, session: VoiceSession) {
  try {
    await markDraftWanted(env, userId, session.id);
    if (!(await claimDraftBuild(env, userId, session.id))) return;
    for (let round = 0; round < MAX_ROUNDS; round++) {
      await rebuildOnce(env, userId, session);
      if (await releaseDraftBuild(env, userId, session.id)) return;
    }
    await dropDraftBuild(env, userId, session.id);
  } catch (error) {
    console.warn("voice draft rebuild stopped:", error instanceof Error ? error.message : error);
    await dropDraftBuild(env, userId, session.id).catch(() => {});
  }
}

async function waitForFullDraft(env: Env, userId: string, sessionId: string, turnCount: number) {
  const deadline = Date.now() + draftTiming.waitMs;
  for (;;) {
    const draft = await readDraft(env, userId, sessionId);
    if (draft.raw && draft.coversTurns === turnCount) return draft.raw;
    if (!draft.pending || Date.now() >= deadline) return null;
    await pause(draftTiming.pollMs);
  }
}

/** The report for /finish: the live draft when it covers every turn, otherwise built now exactly as before. */
export async function finalReport(env: Env, userId: string, session: VoiceSession, turns: StoredTurn[]): Promise<Debrief> {
  const draft = await waitForFullDraft(env, userId, session.id, turns.length);
  const report = draft ? normalizeDebrief(draft, turns) : await buildDebrief(env, session.plan, turns);
  return withInterest(withLiveTips(report, turns), turns);
}

/** The latest draft, normalized over the turns it was built from, for a preview while the interview runs. */
export async function latestDraft(env: Env, userId: string, sessionId: string) {
  const draft = await readDraft(env, userId, sessionId);
  if (!draft.raw) return null;
  const turns = await listTurns(env, userId, sessionId);
  // tips land on their own schedule, so the preview shows every one so far, even past the turns the draft covers
  const report = withLiveTips(normalizeDebrief(draft.raw, turns.slice(0, draft.coversTurns)), turns);
  return { coversTurns: draft.coversTurns, totalTurns: turns.length, report };
}
