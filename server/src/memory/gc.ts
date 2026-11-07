import type { Env } from "../env";
import { deleteExpiredDocuments } from "../documents/store";

const DAY_MS = 86_400_000;
const MEMORY_IDLE_DAYS = 30;
const FACT_MAX_AGE_DAYS = 14;
const VECTOR_DELETE_BATCH = 100;

// swapped out in tests: Vectorize only exists remotely
export const deps = {
  deleteVectors: async (env: Env, ids: string[]) => {
    await env.VECTORS.deleteByIds(ids);
  },
};

const daysBefore = (now: Date, days: number) => new Date(now.getTime() - days * DAY_MS).toISOString();

async function deleteIdleMemories(env: Env, now: Date) {
  const res = await env.DB.prepare("DELETE FROM user_memories WHERE last_used_at < ?").bind(daysBefore(now, MEMORY_IDLE_DAYS)).run();
  return res.meta.changes;
}

// a fact that hasn't been re-verified in two weeks may no longer be true, so it goes along with its vector
async function deleteStaleFacts(env: Env, now: Date) {
  const { results } = await env.DB.prepare("DELETE FROM company_facts WHERE fetched_at < ? RETURNING id")
    .bind(daysBefore(now, FACT_MAX_AGE_DAYS))
    .all<{ id: string }>();
  const vectorIds = results.map((row) => `fact:${row.id}`);
  for (let i = 0; i < vectorIds.length; i += VECTOR_DELETE_BATCH) {
    await deps.deleteVectors(env, vectorIds.slice(i, i + VECTOR_DELETE_BATCH));
  }
  return results.length;
}

async function deleteExpiredCache(env: Env, now: Date) {
  const res = await env.DB.prepare("DELETE FROM cache WHERE expires_at <= ?").bind(now.toISOString()).run();
  return res.meta.changes;
}

export async function collectGarbage(env: Env, now = new Date()) {
  return {
    privateDeleted: await deleteIdleMemories(env, now),
    factsDeleted: await deleteStaleFacts(env, now),
    cacheDeleted: await deleteExpiredCache(env, now),
    documentsDeleted: await deleteExpiredDocuments(env, now),
  };
}
