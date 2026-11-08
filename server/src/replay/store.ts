import { db } from "../db";
import type { Env } from "../env";
import { decryptFor, encryptFor } from "../memory/private/crypto";
import type { Debrief } from "../voice/debrief";

type ReplayRow = { conversation_id: string | null; report_ciphertext: string | null; report_iv: string | null };

/**
 * Links the ElevenLabs conversation once; a second, different id is refused so a session can't be pointed at
 * another recording later. Returns false when the session isn't the caller's or already has another one.
 */
export async function attachConversation(env: Env, userId: string, sessionId: string, conversationId: string): Promise<boolean> {
  const res = await db(env).prepare("UPDATE voice_sessions SET conversation_id = ? WHERE id = ? AND user_id = ? AND conversation_id IS NULL")
    .bind(conversationId, sessionId, userId)
    .run();
  if (res.meta.changes > 0) return true;
  return (await conversationOf(env, userId, sessionId)) === conversationId;
}

export async function conversationOf(env: Env, userId: string, sessionId: string): Promise<string | null> {
  const row = await db(env).prepare("SELECT conversation_id FROM voice_sessions WHERE id = ? AND user_id = ?").bind(sessionId, userId).first<ReplayRow>();
  return row?.conversation_id ?? null;
}

// the report quotes what the person said, so it is sealed like the answers it came from
export async function saveReport(env: Env, userId: string, sessionId: string, report: Debrief) {
  const sealed = await encryptFor(env.MEMORY_SECRET, userId, JSON.stringify(report));
  await db(env).prepare("UPDATE voice_sessions SET report_ciphertext = ?, report_iv = ? WHERE id = ? AND user_id = ?")
    .bind(sealed.ciphertext, sealed.iv, sessionId, userId)
    .run();
}

export async function loadReplayRecord(env: Env, userId: string, sessionId: string): Promise<{ conversationId: string | null; report: Debrief | null }> {
  const row = await db(env).prepare("SELECT conversation_id, report_ciphertext, report_iv FROM voice_sessions WHERE id = ? AND user_id = ?")
    .bind(sessionId, userId)
    .first<ReplayRow>();
  if (!row) return { conversationId: null, report: null };
  const report = row.report_ciphertext && row.report_iv
    ? (JSON.parse(await decryptFor(env.MEMORY_SECRET, userId, { ciphertext: row.report_ciphertext, iv: row.report_iv })) as Debrief)
    : null;
  return { conversationId: row.conversation_id, report };
}

export async function conversationsOfUser(env: Env, userId: string): Promise<string[]> {
  const { results } = await db(env).prepare("SELECT conversation_id FROM voice_sessions WHERE user_id = ? AND conversation_id IS NOT NULL")
    .bind(userId)
    .all<{ conversation_id: string }>();
  return results.map((row) => row.conversation_id);
}

export async function conversationsBefore(env: Env, cutoff: string): Promise<string[]> {
  const { results } = await db(env).prepare("SELECT conversation_id FROM voice_sessions WHERE created_at < ? AND conversation_id IS NOT NULL")
    .bind(cutoff)
    .all<{ conversation_id: string }>();
  return results.map((row) => row.conversation_id);
}

export async function deleteSession(env: Env, userId: string, sessionId: string) {
  await db(env).batch([
    db(env).prepare("DELETE FROM voice_turns WHERE session_id = ? AND user_id = ?").bind(sessionId, userId),
    db(env).prepare("DELETE FROM voice_sessions WHERE id = ? AND user_id = ?").bind(sessionId, userId),
  ]);
}
