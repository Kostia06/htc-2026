import { db } from "../db";
import type { Env } from "../env";
import { decryptFor, encryptFor } from "../memory/private/crypto";
import type { LiveTip } from "./coach/types";
import type { TurnScore } from "./score";
import type { VoiceMode, VoicePlan } from "./types";

export const KEEP_DAYS = 30;

/** `stepId` is the road step the session was started from; finishing the session marks it done. */
export type VoiceSession = {
  id: string;
  mode: VoiceMode;
  companySlug: string | null;
  stepId: string | null;
  plan: VoicePlan;
  status: "active" | "finished";
  createdAt: string;
};
/** Seconds since the call connected, by the client's clock: when the answer began and when it was sent for scoring. */
export type TurnTiming = { answerStartSec?: number; atSec?: number };
export type StoredTurn = { idx: number; question: string; answer: string } & TurnScore & TurnTiming & { liveTip?: LiveTip };

type SessionRow = {
  id: string;
  mode: VoiceMode;
  company_slug: string | null;
  step_id: string | null;
  ciphertext: string;
  iv: string;
  status: "active" | "finished";
  created_at: string;
};
type TurnRow = {
  idx: number;
  ciphertext: string;
  iv: string;
  scores_json: string;
  at_sec: number | null;
  answer_start_sec: number | null;
  tip_ciphertext: string | null;
  tip_iv: string | null;
};

// every query carries user_id, so a session id alone never reaches someone else's conversation
export async function createSession(
  env: Env,
  userId: string,
  session: { mode: VoiceMode; companySlug: string | null; stepId?: string; plan: VoicePlan },
  now = new Date(),
): Promise<string> {
  const id = crypto.randomUUID();
  const sealed = await encryptFor(env.MEMORY_SECRET, userId, JSON.stringify(session.plan));
  await db(env).prepare(
    "INSERT INTO voice_sessions (id, user_id, mode, company_slug, step_id, ciphertext, iv, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)",
  )
    .bind(id, userId, session.mode, session.companySlug, session.stepId ?? null, sealed.ciphertext, sealed.iv, now.toISOString())
    .run();
  return id;
}

// a session from the retired networking mode has no questions in its plan, so it is treated as unknown
export async function findSession(env: Env, userId: string, id: string): Promise<VoiceSession | null> {
  const row = await db(env).prepare("SELECT * FROM voice_sessions WHERE id = ? AND user_id = ? AND mode = 'interview'").bind(id, userId).first<SessionRow>();
  if (!row) return null;
  const plan = JSON.parse(await decryptFor(env.MEMORY_SECRET, userId, row)) as VoicePlan;
  return { id: row.id, mode: row.mode, companySlug: row.company_slug, stepId: row.step_id, plan, status: row.status, createdAt: row.created_at };
}

export async function countSessionsSince(env: Env, userId: string, since: Date) {
  const row = await db(env).prepare("SELECT COUNT(*) AS n FROM voice_sessions WHERE user_id = ? AND created_at > ?")
    .bind(userId, since.toISOString())
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/** Stores one scored answer and returns its index in the session. */
export async function addTurn(
  env: Env,
  userId: string,
  sessionId: string,
  turn: { question: string; answer: string; score: TurnScore; timing?: TurnTiming },
): Promise<number> {
  const sealed = await encryptFor(env.MEMORY_SECRET, userId, JSON.stringify({ question: turn.question, answer: turn.answer }));
  // the next index is computed inside the insert so two quick turns can't claim the same slot
  const row = await db(env).prepare(
    `INSERT INTO voice_turns (session_id, user_id, idx, ciphertext, iv, scores_json, created_at, at_sec, answer_start_sec)
     SELECT ?, ?, COALESCE(MAX(idx) + 1, 0), ?, ?, ?, ?, ?, ? FROM voice_turns WHERE session_id = ?
     RETURNING idx`,
  )
    .bind(
      sessionId,
      userId,
      sealed.ciphertext,
      sealed.iv,
      JSON.stringify(turn.score),
      new Date().toISOString(),
      turn.timing?.atSec ?? null,
      turn.timing?.answerStartSec ?? null,
      sessionId,
    )
    .first<{ idx: number }>();
  return row?.idx ?? 0;
}

// a tip is attached after the turn is stored, so it never holds up the score the person is waiting for
export async function saveLiveTip(env: Env, userId: string, sessionId: string, idx: number, tip: LiveTip) {
  const sealed = await encryptFor(env.MEMORY_SECRET, userId, JSON.stringify(tip));
  await db(env).prepare("UPDATE voice_turns SET tip_ciphertext = ?, tip_iv = ? WHERE session_id = ? AND user_id = ? AND idx = ?")
    .bind(sealed.ciphertext, sealed.iv, sessionId, userId, idx)
    .run();
}

async function readTurn(env: Env, userId: string, row: TurnRow): Promise<StoredTurn> {
  const text = JSON.parse(await decryptFor(env.MEMORY_SECRET, userId, row)) as { question: string; answer: string };
  const turn: StoredTurn = { idx: row.idx, ...text, ...(JSON.parse(row.scores_json) as TurnScore) };
  if (row.answer_start_sec !== null) turn.answerStartSec = row.answer_start_sec;
  if (row.at_sec !== null) turn.atSec = row.at_sec;
  if (row.tip_ciphertext && row.tip_iv) {
    turn.liveTip = JSON.parse(await decryptFor(env.MEMORY_SECRET, userId, { ciphertext: row.tip_ciphertext, iv: row.tip_iv })) as LiveTip;
  }
  return turn;
}

export async function listTurns(env: Env, userId: string, sessionId: string): Promise<StoredTurn[]> {
  const { results } = await db(env).prepare(
    "SELECT idx, ciphertext, iv, scores_json, at_sec, answer_start_sec, tip_ciphertext, tip_iv FROM voice_turns WHERE session_id = ? AND user_id = ? ORDER BY idx",
  )
    .bind(sessionId, userId)
    .all<TurnRow>();
  return Promise.all(results.map((row) => readTurn(env, userId, row)));
}

// overall is the report's 0-100 score, kept so history shows the number the person already saw
export async function finishSession(env: Env, userId: string, id: string, overall: number | null = null) {
  await db(env).prepare("UPDATE voice_sessions SET status = 'finished', finished_at = ?, overall = ? WHERE id = ? AND user_id = ?")
    .bind(new Date().toISOString(), overall, id, userId)
    .run();
}

export async function deleteOldSessions(env: Env, now = new Date()) {
  const cutoff = new Date(now.getTime() - KEEP_DAYS * 86_400_000).toISOString();
  await db(env).prepare("DELETE FROM voice_turns WHERE session_id IN (SELECT id FROM voice_sessions WHERE created_at < ?)").bind(cutoff).run();
  const result = await db(env).prepare("DELETE FROM voice_sessions WHERE created_at < ?").bind(cutoff).run();
  return result.meta.changes;
}
