import { db } from "../db";
import type { Env } from "../env";
import { decryptFor, encryptFor } from "../memory/private/crypto";

// longer than the slowest model call with its retries, so only a rebuild that died still holds the claim
const CLAIM_TIMEOUT_MS = 2 * 60_000;

// pending: a rebuild is running, or a turn is stored and its rebuild is about to claim
export type DraftState = { coversTurns: number; raw: Record<string, unknown> | null; pending: boolean };
type DraftRow = { draft_ciphertext: string | null; draft_iv: string | null; draft_turns: number | null; draft_building_since: string | null; draft_dirty: number };

const staleBefore = (now: Date) => new Date(now.getTime() - CLAIM_TIMEOUT_MS).toISOString();

export async function markDraftWanted(env: Env, userId: string, id: string) {
  await db(env).prepare("UPDATE voice_sessions SET draft_dirty = 1 WHERE id = ? AND user_id = ?").bind(id, userId).run();
}

export async function clearDraftWanted(env: Env, userId: string, id: string) {
  await db(env).prepare("UPDATE voice_sessions SET draft_dirty = 0 WHERE id = ? AND user_id = ?").bind(id, userId).run();
}

export async function claimDraftBuild(env: Env, userId: string, id: string, now = new Date()) {
  const result = await db(env).prepare(
    `UPDATE voice_sessions SET draft_building_since = ?
     WHERE id = ? AND user_id = ? AND (draft_building_since IS NULL OR draft_building_since < ?)`,
  )
    .bind(now.toISOString(), id, userId, staleBefore(now))
    .run();
  return result.meta.changes > 0;
}

// refuses while a newer turn is waiting, which tells the builder to go round once more
export async function releaseDraftBuild(env: Env, userId: string, id: string) {
  const result = await db(env).prepare("UPDATE voice_sessions SET draft_building_since = NULL WHERE id = ? AND user_id = ? AND draft_dirty = 0")
    .bind(id, userId)
    .run();
  return result.meta.changes > 0;
}

export async function dropDraftBuild(env: Env, userId: string, id: string) {
  await db(env).prepare("UPDATE voice_sessions SET draft_building_since = NULL WHERE id = ? AND user_id = ?").bind(id, userId).run();
}

// a slower rebuild over fewer turns must not overwrite a newer draft
export async function saveDraft(env: Env, userId: string, id: string, raw: Record<string, unknown>, coversTurns: number) {
  const sealed = await encryptFor(env.MEMORY_SECRET, userId, JSON.stringify(raw));
  await db(env).prepare(
    `UPDATE voice_sessions SET draft_ciphertext = ?, draft_iv = ?, draft_turns = ?
     WHERE id = ? AND user_id = ? AND (draft_turns IS NULL OR draft_turns <= ?)`,
  )
    .bind(sealed.ciphertext, sealed.iv, coversTurns, id, userId, coversTurns)
    .run();
}

export async function readDraft(env: Env, userId: string, id: string, now = new Date()): Promise<DraftState> {
  const row = await db(env).prepare(
    "SELECT draft_ciphertext, draft_iv, draft_turns, draft_building_since, draft_dirty FROM voice_sessions WHERE id = ? AND user_id = ?",
  )
    .bind(id, userId)
    .first<DraftRow>();
  const building = !!row?.draft_building_since && row.draft_building_since >= staleBefore(now);
  const pending = building || Number(row?.draft_dirty ?? 0) === 1;
  if (!row?.draft_ciphertext || !row.draft_iv) return { coversTurns: 0, raw: null, pending };
  const raw = JSON.parse(await decryptFor(env.MEMORY_SECRET, userId, { ciphertext: row.draft_ciphertext, iv: row.draft_iv })) as Record<string, unknown>;
  return { coversTurns: row.draft_turns ?? 0, raw, pending };
}
