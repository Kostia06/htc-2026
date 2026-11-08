import { db } from "../db";
import type { Env } from "../env";
import { DIFFICULTIES, type Difficulty, type InterviewLength, LENGTHS, VOICE_MODES, type VoiceMode } from "../voice/types";

// long enough to put the headset on, short enough that a forgotten tap doesn't start a session tomorrow
export const LAUNCH_LIFETIME_MS = 2 * 60 * 1000;
export const MAX_WAIT_MS = 20_000;
const CHECK_INTERVAL_MS = 1500;

/** `reviewSessionId` opens that past session's review instead of a new interview; the headset proves ownership when it loads it. */
export type Launch = {
  mode: VoiceMode;
  companySlug?: string;
  role?: string;
  stepId?: string;
  difficulty?: Difficulty;
  length?: InterviewLength;
  reviewSessionId?: string;
};

// swapped out in tests, which must not wait real seconds
export const deps = {
  sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
};

const optionalText = (value: unknown, max: number) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return null;
  const text = value.trim().slice(0, max);
  return text || undefined;
};

const isOneOf = <T extends string>(choices: readonly T[], value: unknown): value is T | undefined => value === undefined || choices.includes(value as T);

/** The phone's request body, or null when it isn't a launch. Same fields `POST /api/voice/sessions` takes. */
export function parseLaunch(body: unknown): Launch | null {
  if (!body || typeof body !== "object") return null;
  const { mode, companySlug, role, stepId, difficulty, length, reviewSessionId } = body as Record<string, unknown>;
  if (!VOICE_MODES.includes(mode as VoiceMode)) return null;
  if (!isOneOf(DIFFICULTIES, difficulty) || !isOneOf(LENGTHS, length)) return null;
  const fields = {
    companySlug: optionalText(companySlug, 100),
    role: optionalText(role, 100),
    stepId: optionalText(stepId, 100),
    reviewSessionId: optionalText(reviewSessionId, 100),
  };
  if (Object.values(fields).includes(null)) return null;
  const launch: Launch = { mode: mode as VoiceMode };
  if (fields.companySlug) launch.companySlug = fields.companySlug;
  if (fields.role) launch.role = fields.role;
  if (fields.stepId) launch.stepId = fields.stepId;
  if (difficulty) launch.difficulty = difficulty;
  if (length) launch.length = length;
  if (fields.reviewSessionId) launch.reviewSessionId = fields.reviewSessionId;
  return launch;
}

export async function queueLaunch(env: Env, userId: string, launch: Launch, now = new Date()) {
  const expiresAt = new Date(now.getTime() + LAUNCH_LIFETIME_MS).toISOString();
  await db(env).prepare(
    `INSERT INTO headset_launches (user_id, mode, company_slug, role, step_id, difficulty, interview_length, review_session_id, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET mode = excluded.mode, company_slug = excluded.company_slug, role = excluded.role, step_id = excluded.step_id,
       difficulty = excluded.difficulty, interview_length = excluded.interview_length, review_session_id = excluded.review_session_id,
       created_at = excluded.created_at, expires_at = excluded.expires_at`,
  )
    .bind(
      userId,
      launch.mode,
      launch.companySlug ?? null,
      launch.role ?? null,
      launch.stepId ?? null,
      launch.difficulty ?? null,
      launch.length ?? null,
      launch.reviewSessionId ?? null,
      now.toISOString(),
      expiresAt,
    )
    .run();
  return { expiresAt };
}

type LaunchRow = {
  mode: VoiceMode;
  company_slug: string | null;
  role: string | null;
  step_id: string | null;
  difficulty: Difficulty | null;
  interview_length: InterviewLength | null;
  review_session_id: string | null;
};

/** Removes and returns the person's pending launch; of two headsets polling, only one gets it. */
export async function takeLaunch(env: Env, userId: string, now = new Date()): Promise<Launch | null> {
  const row = await db(env).prepare(
    "DELETE FROM headset_launches WHERE user_id = ? AND expires_at > ? RETURNING mode, company_slug, role, step_id, difficulty, interview_length, review_session_id",
  )
    .bind(userId, now.toISOString())
    .first<LaunchRow>();
  if (!row) return null;
  const launch: Launch = { mode: row.mode };
  if (row.company_slug) launch.companySlug = row.company_slug;
  if (row.role) launch.role = row.role;
  if (row.step_id) launch.stepId = row.step_id;
  if (row.difficulty) launch.difficulty = row.difficulty;
  if (row.interview_length) launch.length = row.interview_length;
  if (row.review_session_id) launch.reviewSessionId = row.review_session_id;
  return launch;
}

/** Long poll: checks every second and a half until a launch arrives or `waitMs` is up. */
export async function waitForLaunch(env: Env, userId: string, waitMs: number, now: () => Date = () => new Date()): Promise<Launch | null> {
  // counted by what was slept, not the wall clock, so a test with an instant sleep still ends
  let remaining = Math.min(Math.max(waitMs, 0), MAX_WAIT_MS);
  for (;;) {
    const launch = await takeLaunch(env, userId, now());
    if (launch) return launch;
    if (remaining <= 0) return null;
    const nap = Math.min(CHECK_INTERVAL_MS, remaining);
    await deps.sleep(nap);
    remaining -= nap;
  }
}

export async function deleteExpiredLaunches(env: Env, now = new Date()) {
  const result = await db(env).prepare("DELETE FROM headset_launches WHERE expires_at <= ?").bind(now.toISOString()).run();
  return result.meta.changes;
}
