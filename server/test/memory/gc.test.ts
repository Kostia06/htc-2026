import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { collectGarbage, deps } from "../../src/memory/gc";

const NOW = new Date("2026-06-01T00:00:00.000Z");
const daysBefore = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

function insertMemory(id: string, lastUsedAt: string) {
  return env.DB.prepare(
    "INSERT INTO user_memories (id, user_id, kind, ciphertext, iv, created_at, last_used_at, uses) VALUES (?, 'alice', 'note', 'x', 'y', ?, ?, 0)",
  ).bind(id, lastUsedAt, lastUsedAt);
}

function insertFact(id: string, fetchedAt: string) {
  return env.DB.prepare(
    "INSERT INTO company_facts (id, company_id, kind, text, source_url, fetched_at, content_hash) VALUES (?, 'c1', 'news', ?, 'https://acme.com', ?, ?)",
  ).bind(id, `fact ${id}`, fetchedAt, `hash-${id}`);
}

function insertCache(key: string, expiresAt: string) {
  return env.DB.prepare("INSERT INTO cache (key, value, expires_at) VALUES (?, '1', ?)").bind(key, expiresAt);
}

async function ids(sql: string) {
  const { results } = await env.DB.prepare(sql).all<{ id: string }>();
  return results.map((r) => r.id).sort();
}

describe("collectGarbage", () => {
  beforeEach(async () => {
    vi.spyOn(deps, "deleteVectors").mockResolvedValue();
    await env.DB.prepare("INSERT INTO companies (id, slug, name) VALUES ('c1', 'acme', 'Acme')").run();
    await env.DB.batch([
      insertMemory("stale-memory", daysBefore(31)),
      insertMemory("used-memory", daysBefore(29)),
      insertFact("stale-fact", daysBefore(15)),
      insertFact("fresh-fact", daysBefore(13)),
      insertCache("expired", daysBefore(1)),
      insertCache("live", new Date(NOW.getTime() + 60_000).toISOString()),
    ]);
  });

  it("deletes stale memories, facts and cache rows and keeps the rest", async () => {
    expect(await collectGarbage(env, NOW)).toEqual({ privateDeleted: 1, factsDeleted: 1, cacheDeleted: 1, documentsDeleted: 0, pairingsDeleted: 0, voiceSessionsDeleted: 0 });

    expect(await ids("SELECT id FROM user_memories")).toEqual(["used-memory"]);
    expect(await ids("SELECT id FROM company_facts")).toEqual(["fresh-fact"]);
    expect(await ids("SELECT key AS id FROM cache")).toEqual(["live"]);
  });

  it("removes the vectors of deleted facts from the shared index", async () => {
    await collectGarbage(env, NOW);
    expect(deps.deleteVectors).toHaveBeenCalledWith(env, ["fact:stale-fact"]);
  });

  it("leaves the vector index alone when no facts were deleted", async () => {
    await collectGarbage(env, new Date(daysBefore(10)));
    expect(deps.deleteVectors).not.toHaveBeenCalled();
  });
});
