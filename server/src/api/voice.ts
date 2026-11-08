import { Hono } from "hono";
import type { AppContext } from "../env";
import { claimCooldown } from "../memory/cooldowns";
import { coachTurn } from "../voice/coach/live";
import { endedForConduct, noteConductEnding } from "../voice/conduct";
import { notePatterns } from "../voice/coach/patterns";
import { finalReport, latestDraft, refreshDraft } from "../voice/draft";
import { saveReport } from "../replay/store";
import { setStepStatus } from "../roadmap/store";
import { answerHint } from "../voice/hint";
import { getProfile } from "../memory/profile/store";
import { nextLine, SPEAKERS, type TranscriptLine } from "../voice/next";
import { ProviderNotConfigured } from "../voice/providers";
import { scoreTurn } from "../voice/score";
import { startVoiceSession, UnknownCompany, UnknownPosting } from "../voice/session";
import { notifyAfterWrite } from "../notifications/generate";
import { addTurn, countSessionsSince, findSession, finishSession, listTurns, type TurnTiming } from "../voice/store";
import { DIFFICULTIES, type Difficulty, type InterviewLength, LENGTHS, VOICE_MODES, type VoiceMode } from "../voice/types";

// no usage cap for now (hackathon demo); set a number to bring one back
const SESSIONS_PER_HOUR = Number.POSITIVE_INFINITY;
const MAX_ANSWER = 4000;
const MAX_TRANSCRIPT_LINES = 80;
// a real turn takes seconds of speech; faster than this is a loop or a script, not a person
const NEXT_LINE_COOLDOWN_MS = 1000;

const isText = (value: unknown, max: number): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= max;
const optionalText = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim().slice(0, 100) : undefined);

function parseTranscript(value: unknown): TranscriptLine[] | null {
  if (!Array.isArray(value) || value.length > MAX_TRANSCRIPT_LINES) return null;
  const valid = value.every(
    (line) => SPEAKERS.includes(line?.speaker) && typeof line?.text === "string" && line.text.length <= 1000,
  );
  return valid ? value.map((line) => ({ speaker: line.speaker, text: line.text })) : null;
}

// a practice call is minutes long; anything past four hours is a broken clock, not a timestamp
const MAX_CALL_SEC = 4 * 3600;
const callSeconds = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= MAX_CALL_SEC ? value : undefined);

// both from the client's clock, counted from when the call connected; a start after the send time is dropped
function parseTiming(body: { atSec?: unknown; answerStartSec?: unknown }): TurnTiming {
  const atSec = callSeconds(body.atSec);
  const start = callSeconds(body.answerStartSec);
  const answerStartSec = start !== undefined && (atSec === undefined || start <= atSec) ? start : undefined;
  return { atSec, answerStartSec };
}

export function voiceRouter() {
  const router = new Hono<AppContext>();

  router.post("/sessions", async (c) => {
    const body = await c.req.json<{ mode?: unknown; companySlug?: unknown; role?: unknown; difficulty?: unknown; length?: unknown; postingId?: unknown; stepId?: unknown }>().catch(() => null);
    if (!body || !VOICE_MODES.includes(body.mode as VoiceMode)) return c.json({ error: "mode must be interview" }, 400);
    if (body.difficulty !== undefined && !DIFFICULTIES.includes(body.difficulty as Difficulty)) {
      return c.json({ error: "difficulty must be easy, standard or hard" }, 400);
    }
    if (body.length !== undefined && !LENGTHS.includes(body.length as InterviewLength)) {
      return c.json({ error: "length must be quick or full" }, 400);
    }
    const userId = c.var.sessionId;
    if ((await countSessionsSince(c.env, userId, new Date(Date.now() - 3600_000))) >= SESSIONS_PER_HOUR) {
      return c.json({ error: "that's a lot of practice for one hour, take a break and try again soon" }, 429);
    }
    try {
      const started = await startVoiceSession(c.env, userId, {
        mode: body.mode as VoiceMode,
        companySlug: optionalText(body.companySlug),
        role: optionalText(body.role),
        difficulty: body.difficulty as Difficulty | undefined,
        length: body.length as InterviewLength | undefined,
        postingId: optionalText(body.postingId),
        stepId: optionalText(body.stepId),
      });
      return c.json(started, 201);
    } catch (e) {
      if (e instanceof UnknownCompany) return c.json({ error: "unknown company" }, 404);
      if (e instanceof UnknownPosting) return c.json({ error: "unknown posting" }, 404);
      if (e instanceof ProviderNotConfigured) return c.json({ error: "voice practice isn't set up on this server yet" }, 503);
      throw e;
    }
  });

  // the fast path: Jev and code only, so feedback lands while the next question is being asked
  router.post("/sessions/:id/turns", async (c) => {
    const session = await findSession(c.env, c.var.sessionId, c.req.param("id"));
    if (!session) return c.json({ error: "unknown session" }, 404);
    if (session.status === "finished") return c.json({ error: "this session has ended" }, 409);
    const body = await c.req.json<{ question?: unknown; answer?: unknown; durationMs?: unknown; atSec?: unknown; answerStartSec?: unknown }>().catch(() => null);
    if (!body || !isText(body.question, 1000) || !isText(body.answer, MAX_ANSWER)) return c.json({ error: "send the question and the answer text" }, 400);
    const durationMs = typeof body.durationMs === "number" && body.durationMs > 0 ? body.durationMs : 0;

    const score = await scoreTurn(c.env, { question: body.question, answer: body.answer, durationMs });
    const turn = { question: body.question, answer: body.answer, score };
    const idx = await addTurn(c.env, c.var.sessionId, session.id, { ...turn, timing: parseTiming(body) });
    // the report is rebuilt while the next question is asked, so it is ready the moment the interview ends
    c.executionCtx.waitUntil(refreshDraft(c.env, c.var.sessionId, session));
    // a weak answer gets a researched rewrite pinned to its timestamp, also while the call goes on
    c.executionCtx.waitUntil(coachTurn(c.env, c.var.sessionId, session, idx, turn));
    return c.json(score);
  });

  // VR's Hints panel: talking points for the question on the table, from the candidate's own profile; never spoken
  router.post("/sessions/:id/hint", async (c) => {
    const session = await findSession(c.env, c.var.sessionId, c.req.param("id"));
    if (!session) return c.json({ error: "unknown session" }, 404);
    const body = await c.req.json<{ question?: unknown }>().catch(() => null);
    if (!body || !isText(body.question, 1000)) return c.json({ error: "send the question" }, 400);
    const question = body.question.trim();
    try {
      const hint = await answerHint(c.env, `${session.id}:${question}`, {
        role: session.plan.role,
        company: session.plan.company,
        question,
        profile: await getProfile(c.env, c.var.sessionId),
      });
      return c.json(hint);
    } catch (e) {
      console.warn("voice hint failed", e);
      return c.json({ error: "no hint right now" }, 502);
    }
  });

  // what the interviewer says next: a quick follow-up or the next planned question, decided in about a second
  router.post("/sessions/:id/next", async (c) => {
    const userId = c.var.sessionId;
    const session = await findSession(c.env, userId, c.req.param("id"));
    if (!session) return c.json({ error: "unknown session" }, 404);
    if (session.status === "finished") return c.json({ error: "this session has ended" }, 409);
    const body = await c.req.json<{ answer?: unknown; transcript?: unknown }>().catch(() => null);
    const transcript = parseTranscript(body?.transcript);
    if (!body || typeof body.answer !== "string" || body.answer.length > MAX_ANSWER || !transcript) {
      return c.json({ error: "send the answer and the transcript so far" }, 400);
    }
    if (!(await claimCooldown(c.env, "voice-next", userId, NEXT_LINE_COOLDOWN_MS))) return c.json({ error: "one moment, still thinking" }, 429);
    return c.json(await nextLine(c.env, session.plan, { answer: body.answer, transcript }));
  });

  router.post("/sessions/:id/finish", async (c) => {
    const userId = c.var.sessionId;
    const session = await findSession(c.env, userId, c.req.param("id"));
    if (!session) return c.json({ error: "unknown session" }, 404);
    const turns = await listTurns(c.env, userId, session.id);
    if (turns.length === 0) return c.json({ error: "nothing was said in this session yet" }, 400);
    // the agent's goodbye has no answer after it, so it never became a turn; the client sends it along
    const body = await c.req.json<{ closingLine?: unknown }>().catch(() => null);
    const closingLine = typeof body?.closingLine === "string" ? body.closingLine.slice(0, 1000) : undefined;

    // the same debrief on the phone and in the headset; usually the live draft, so no model call is left to wait on
    const report = await finalReport(c.env, userId, session, turns);
    const debrief = endedForConduct(turns, closingLine) ? noteConductEnding(report) : report;
    await finishSession(c.env, userId, session.id, debrief.overall);
    await saveReport(c.env, userId, session.id, debrief);
    // scoped by user, so a step id from someone else's road is simply not found
    if (session.stepId) await setStepStatus(c.env, userId, session.stepId, "done", undefined);
    c.executionCtx.waitUntil(notePatterns(c.env, userId, session.id, turns));
    notifyAfterWrite(c.env, userId, (work) => c.executionCtx.waitUntil(work));
    return c.json(debrief);
  });

  // a preview of the report so far; the final word is still /finish
  router.get("/sessions/:id/report", async (c) => {
    const draft = await latestDraft(c.env, c.var.sessionId, c.req.param("id"));
    return draft ? c.json(draft) : c.json({ error: "no report yet" }, 404);
  });

  router.get("/sessions/:id", async (c) => {
    const session = await findSession(c.env, c.var.sessionId, c.req.param("id"));
    if (!session) return c.json({ error: "unknown session" }, 404);
    const { plan: _, ...summary } = session;
    return c.json({ ...summary, turns: await listTurns(c.env, c.var.sessionId, session.id) });
  });

  return router;
}

export const voice = voiceRouter();
