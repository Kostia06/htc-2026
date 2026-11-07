import type { Env } from "../../env";
import { anonymize } from "../../lib/anonymize";
import { decryptFor, encryptFor } from "./crypto";
import { relevance } from "./ranking";

export type MemoryKind = "goal" | "skill" | "weakness" | "preference" | "note";
export type PrivateMemory = { id: string; kind: MemoryKind; text: string; createdAt: string; lastUsedAt: string; uses: number };

const MAX_MEMORY_LENGTH = 500;
const MAX_MEMORIES_PER_USER = 200;
const DEFAULT_RECALL_LIMIT = 8;

type MemoryRow = { id: string; kind: MemoryKind; ciphertext: string; iv: string; created_at: string; last_used_at: string; uses: number };

// Private memories live only in D1, encrypted per user. They must never be embedded into Vectorize: that index is shared by everyone.
// Every query below filters by user_id in SQL, so a wrong id can never reach another person's rows.

async function decryptRows(env: Env, userId: string, rows: MemoryRow[]): Promise<PrivateMemory[]> {
  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      kind: row.kind,
      text: await decryptFor(env.MEMORY_SECRET, userId, row),
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
      uses: row.uses,
    })),
  );
}

async function loadRows(env: Env, userId: string, kinds?: MemoryKind[]) {
  const kindFilter = kinds?.length ? ` AND kind IN (${kinds.map(() => "?").join(", ")})` : "";
  const { results } = await env.DB.prepare(`SELECT * FROM user_memories WHERE user_id = ?${kindFilter} ORDER BY created_at DESC`)
    .bind(userId, ...(kinds ?? []))
    .all<MemoryRow>();
  return results;
}

async function markUsed(env: Env, userId: string, memories: PrivateMemory[], now: string): Promise<PrivateMemory[]> {
  if (memories.length === 0) return [];
  // one statement per row: a single IN (...) would hit D1's 100 bound-parameter cap on large recalls
  const update = env.DB.prepare("UPDATE user_memories SET uses = uses + 1, last_used_at = ? WHERE user_id = ? AND id = ?");
  await env.DB.batch(memories.map((m) => update.bind(now, userId, m.id)));
  return memories.map((m) => ({ ...m, uses: m.uses + 1, lastUsedAt: now }));
}

async function makeRoom(env: Env, userId: string) {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM user_memories WHERE user_id = ?").bind(userId).first<{ n: number }>();
  const overflow = (row?.n ?? 0) - MAX_MEMORIES_PER_USER + 1;
  if (overflow <= 0) return;
  await env.DB.prepare(
    `DELETE FROM user_memories WHERE user_id = ? AND id IN (
      SELECT id FROM user_memories WHERE user_id = ? ORDER BY last_used_at ASC, created_at ASC LIMIT ?
    )`,
  )
    .bind(userId, userId, overflow)
    .run();
}

function cleanText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("memory text is empty");
  if (trimmed.length > MAX_MEMORY_LENGTH) throw new Error(`memory text is over ${MAX_MEMORY_LENGTH} characters`);
  // no known names: a person's own name is fine in their own memory, only contact details are stripped
  return anonymize(trimmed);
}

export async function remember(env: Env, userId: string, item: { kind: MemoryKind; text: string }): Promise<PrivateMemory> {
  const text = cleanText(item.text);
  const now = new Date().toISOString();

  const sameKind = await decryptRows(env, userId, await loadRows(env, userId, [item.kind]));
  const duplicate = sameKind.find((m) => m.text === text);
  if (duplicate) {
    const [bumped] = await markUsed(env, userId, [duplicate], now);
    return bumped;
  }

  await makeRoom(env, userId);
  const id = crypto.randomUUID();
  const sealed = await encryptFor(env.MEMORY_SECRET, userId, text);
  await env.DB.prepare(
    "INSERT INTO user_memories (id, user_id, kind, ciphertext, iv, created_at, last_used_at, uses) VALUES (?, ?, ?, ?, ?, ?, ?, 0)",
  )
    .bind(id, userId, item.kind, sealed.ciphertext, sealed.iv, now, now)
    .run();
  return { id, kind: item.kind, text, createdAt: now, lastUsedAt: now, uses: 0 };
}

export async function recall(
  env: Env,
  userId: string,
  opts: { query?: string; kinds?: MemoryKind[]; limit?: number } = {},
): Promise<PrivateMemory[]> {
  const now = new Date();
  const memories = await decryptRows(env, userId, await loadRows(env, userId, opts.kinds));
  const ranked = memories
    .map((memory) => ({ memory, score: relevance(memory.text, memory.lastUsedAt, opts.query, now) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit ?? DEFAULT_RECALL_LIMIT)
    .map(({ memory }) => memory);
  return markUsed(env, userId, ranked, now.toISOString());
}

export async function forget(env: Env, userId: string, id: string): Promise<boolean> {
  const res = await env.DB.prepare("DELETE FROM user_memories WHERE id = ? AND user_id = ?").bind(id, userId).run();
  return res.meta.changes > 0;
}

export async function listMemories(env: Env, userId: string): Promise<PrivateMemory[]> {
  return decryptRows(env, userId, await loadRows(env, userId));
}

export async function findMemory(env: Env, userId: string, id: string): Promise<PrivateMemory | null> {
  const row = await env.DB.prepare("SELECT * FROM user_memories WHERE id = ? AND user_id = ?").bind(id, userId).first<MemoryRow>();
  if (!row) return null;
  const [memory] = await decryptRows(env, userId, [row]);
  return memory;
}
