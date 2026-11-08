import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { me } from "../../src/api/me";
import { issueSession, requireSession, verifySession } from "../../src/auth/session";
import type { AppContext } from "../../src/env";

const app = new Hono<AppContext>();
app.use("*", requireSession);
app.route("/", me);

const erase = (token: string) => app.request("/", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }, env);

const NOW = "2026-11-07T10:00:00.000Z";

const TABLES = [
  "user_profiles",
  "user_memories",
  "roadmap_units",
  "roadmap_steps",
  "feed_items",
  "feed_state",
  "voice_sessions",
  "voice_turns",
  "user_documents",
  "agent_runs",
  "pairing_offers",
];

async function seed(userId: string) {
  const tag = userId.slice(0, 8);
  await env.DB.batch([
    env.DB.prepare("INSERT INTO user_profiles (user_id, ciphertext, iv, updated_at) VALUES (?, 'c', 'i', ?)").bind(userId, NOW),
    env.DB.prepare("INSERT INTO user_memories (id, user_id, kind, ciphertext, iv, created_at, last_used_at) VALUES (?, ?, 'note', 'c', 'i', ?, ?)").bind(`m-${tag}`, userId, NOW, NOW),
    env.DB.prepare("INSERT INTO roadmap_units (user_id, idx, ciphertext, iv, created_at) VALUES (?, 0, 'c', 'i', ?)").bind(userId, NOW),
    env.DB.prepare("INSERT INTO roadmap_steps (id, user_id, unit_idx, status, updated_at) VALUES (?, ?, 0, 'todo', ?)").bind(`s-${tag}`, userId, NOW),
    env.DB.prepare("INSERT INTO feed_items (user_id, position, card) VALUES (?, 0, '{}')").bind(userId),
    env.DB.prepare("INSERT INTO feed_state (user_id, built_at) VALUES (?, ?)").bind(userId, NOW),
    env.DB.prepare("INSERT INTO voice_sessions (id, user_id, mode, ciphertext, iv, status, created_at) VALUES (?, ?, 'interview', 'c', 'i', 'finished', ?)").bind(`v-${tag}`, userId, NOW),
    env.DB.prepare("INSERT INTO voice_turns (session_id, user_id, idx, ciphertext, iv, scores_json, created_at) VALUES (?, ?, 0, 'c', 'i', '{}', ?)").bind(`v-${tag}`, userId, NOW),
    env.DB.prepare("INSERT INTO user_documents (id, user_id, ciphertext, iv, created_at, expires_at) VALUES (?, ?, 'c', 'i', ?, ?)").bind(`d-${tag}`, userId, NOW, NOW),
    env.DB.prepare("INSERT INTO agent_runs (id, user_id, skill, platform, status, created_at) VALUES (?, ?, 'x', 'ios', 'done', ?)").bind(`a-${tag}`, userId, NOW),
    env.DB.prepare("INSERT INTO pairing_offers (user_id, code, status, created_at, expires_at) VALUES (?, ?, 'waiting', ?, ?)").bind(userId, `code-${tag}`, NOW, NOW),
  ]);
}

async function rowsFor(userId: string) {
  const counts = await env.DB.batch<{ n: number }>(TABLES.map((t) => env.DB.prepare(`SELECT count(*) AS n FROM ${t} WHERE user_id = ?`).bind(userId)));
  return TABLES.map((t, i) => [t, counts[i].results[0]?.n ?? 0] as const);
}

describe("DELETE /api/me", () => {
  it("erases everything the caller owns and nothing of anyone else's", async () => {
    const a = await issueSession(env.SESSION_SECRET);
    const b = await issueSession(env.SESSION_SECRET);
    const idA = await verifySession(a, env.SESSION_SECRET);
    const idB = await verifySession(b, env.SESSION_SECRET);
    if (!idA || !idB) throw new Error("tokens did not verify");
    await seed(idA);
    await seed(idB);

    const res = await erase(a);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: Object.fromEntries(TABLES.map((t) => [t, 1])) });

    expect(await rowsFor(idA)).toEqual(TABLES.map((t) => [t, 0]));
    expect(await rowsFor(idB)).toEqual(TABLES.map((t) => [t, 1]));
  });

  it("is fine to call with nothing stored", async () => {
    const res = await erase(await issueSession(env.SESSION_SECRET));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: Object.fromEntries(TABLES.map((t) => [t, 0])) });
  });

  it("needs a session", async () => {
    expect((await app.request("/", { method: "DELETE" }, env)).status).toBe(401);
  });
});
