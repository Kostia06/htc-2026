import { db } from "../db";
import type { Env } from "../env";
import { decryptFor, encryptFor } from "../memory/private/crypto";
import type { TurnScore } from "./score";
import type { VoiceMode, VoicePlan } from "./types";

const KEEP_DAYS = 30;

export type VoiceSession = { id: string; mode: VoiceMode; companySlug: string | null; plan: VoicePlan; status: "active" | "finished"; createdAt: string };
export type StoredTurn = { idx: number; question: string; answer: string } & TurnScore;

type SessionRow = { id: string; mode: VoiceMode; company_slug: string | null; ciphertext: string; iv: string; status: "active" | "finished"; created_at: string };
type TurnRow = { idx: number; ciphertext: string; iv: string; scores_json: string };

// every query carries user_id, so a session id alone never reaches someone else's conversation
export async function createSession(
  env: Env,
  userId: string,
  session: { mode: VoiceMode; companySlug: string | null; plan: VoicePlan },
  now = new Date(),
): Promise<string> {
  const id = crypto.randomUUID();
  const sealed = await encryptFor(env.MEMORY_SECRET, userId, JSON.stringify(session.plan));
  await db(env).prepare(
    "INSERT INTO voice_sessions (id, user_id, mode, company_slug, ciphertext, iv, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'active', ?)",
  )
    .bind(id, userId, session.mode, session.companySlug, sealed.ciphertext, sealed.iv, now.toISOString())
    .run();
  return id;
}

// a session from the retired networking mode has no questions in its plan, so it is treated as unknown
export async function findSession(env: Env, userId: string, id: string): Promise<VoiceSession | null> {
  const row = await db(env).prepare("SELECT * FROM voice_sessions WHERE id = ? AND user_id = ? AND mode = 'interview'").bind(id, userId).first<SessionRow>();
  if (!row) return null;
  const plan = JSON.parse(await decryptFor(env.MEMORY_SECRET, userId, row)) as VoicePlan;
  return { id: row.id, mode: row.mode, companySlug: row.company_slug, plan, status: row.status, createdAt: row.created_at };
}

export async function countSessionsSince(env: Env, userId: string, since: Date) {
  const row = await db(env).prepare("SELECT COUNT(*) AS n FROM voice_sessions WHERE user_id = ? AND created_at > ?")
    .bind(userId, since.toISOString())
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function addTurn(env: Env, userId: string, sessionId: string, turn: { question: string; answer: string; score: TurnScore }) {
  const sealed = await encryptFor(env.MEMORY_SECRET, userId, JSON.stringify({ question: turn.question, answer: turn.answer }));
  // the next index is computed inside the insert so two quick turns can't claim the same slot
  await db(env).prepare(
    `INSERT INTO voice_turns (session_id, user_id, idx, ciphertext, iv, scores_json, created_at)
     SELECT ?, ?, COALESCE(MAX(idx) + 1, 0), ?, ?, ?, ? FROM voice_turns WHERE session_id = ?`,
  )
    .bind(sessionId, userId, sealed.ciphertext, sealed.iv, JSON.stringify(turn.score), new Date().toISOString(), sessionId)
    .run();
}

export async function listTurns(env: Env, userId: string, sessionId: string): Promise<StoredTurn[]> {
  const { results } = await db(env).prepare("SELECT idx, ciphertext, iv, scores_json FROM voice_turns WHERE session_id = ? AND user_id = ? ORDER BY idx")
    .bind(sessionId, userId)
    .all<TurnRow>();
  return Promise.all(
    results.map(async (row) => ({
      idx: row.idx,
      ...(JSON.parse(await decryptFor(env.MEMORY_SECRET, userId, row)) as { question: string; answer: string }),
      ...(JSON.parse(row.scores_json) as TurnScore),
    })),
  );
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
