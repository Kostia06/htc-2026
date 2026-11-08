import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { fakeComposio, keyed } from "../connections/fixtures";
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
  "roadmap_steps",
  "feed_items",
  "feed_state",
  "voice_sessions",
  "voice_turns",
  "user_documents",
  "agent_runs",
  "pairing_offers",
  "feed_actions",
  "user_resumes",
  "headset_devices",
  "headset_launches",
  "user_postings",
  "user_tailored_resumes",
  "user_notifications",
  "notification_settings",
  "notification_devices",
  "road_pattern_votes",
  "path_outcomes",
  "user_connections",
];

async function seed(userId: string) {
  const tag = userId.slice(0, 8);
  await env.DB.batch([
    env.DB.prepare("INSERT INTO user_profiles (user_id, ciphertext, iv, updated_at) VALUES (?, 'c', 'i', ?)").bind(userId, NOW),
    env.DB.prepare("INSERT INTO user_memories (id, user_id, kind, ciphertext, iv, created_at, last_used_at) VALUES (?, ?, 'note', 'c', 'i', ?, ?)").bind(`m-${tag}`, userId, NOW, NOW),
    env.DB.prepare("INSERT INTO roadmap_steps (id, user_id, position, source, ciphertext, iv, status, created_at, updated_at) VALUES (?, ?, 0, 'template', 'c', 'i', 'todo', ?, ?)").bind(`s-${tag}`, userId, NOW, NOW),
    env.DB.prepare("INSERT INTO feed_items (user_id, section, position, card) VALUES (?, 'jobs', 0, '{}')").bind(userId),
    env.DB.prepare("INSERT INTO feed_state (user_id, built_at) VALUES (?, ?)").bind(userId, NOW),
    env.DB.prepare("INSERT INTO voice_sessions (id, user_id, mode, ciphertext, iv, status, created_at) VALUES (?, ?, 'interview', 'c', 'i', 'finished', ?)").bind(`v-${tag}`, userId, NOW),
    env.DB.prepare("INSERT INTO voice_turns (session_id, user_id, idx, ciphertext, iv, scores_json, created_at) VALUES (?, ?, 0, 'c', 'i', '{}', ?)").bind(`v-${tag}`, userId, NOW),
    env.DB.prepare("INSERT INTO user_documents (id, user_id, ciphertext, iv, created_at, expires_at) VALUES (?, ?, 'c', 'i', ?, ?)").bind(`d-${tag}`, userId, NOW, NOW),
    env.DB.prepare("INSERT INTO agent_runs (id, user_id, skill, platform, status, created_at) VALUES (?, ?, 'x', 'ios', 'done', ?)").bind(`a-${tag}`, userId, NOW),
    env.DB.prepare("INSERT INTO pairing_offers (user_id, code, status, created_at, expires_at) VALUES (?, ?, 'waiting', ?, ?)").bind(userId, `code-${tag}`, NOW, NOW),
    env.DB.prepare("INSERT INTO feed_actions (user_id, item_id, action, card, created_at) VALUES (?, 'job-1', 'save', '{}', ?)").bind(userId, NOW),
    env.DB.prepare("INSERT INTO user_resumes (user_id, ciphertext, iv, updated_at) VALUES (?, 'c', 'i', ?)").bind(userId, NOW),
    env.DB.prepare("INSERT INTO headset_devices (id, user_id, name, refresh_hash, refresh_expires_at, created_at, last_seen_at) VALUES (?, ?, 'Quest 3', 'h', ?, ?, ?)").bind(`h-${tag}`, userId, NOW, NOW, NOW),
    env.DB.prepare("INSERT INTO headset_launches (user_id, mode, created_at, expires_at) VALUES (?, 'interview', ?, ?)").bind(userId, NOW, NOW),
    env.DB.prepare("INSERT INTO user_postings (id, user_id, company_slug, ciphertext, iv, created_at) VALUES (?, ?, 'acme', 'c', 'i', ?)").bind(`p-${tag}`, userId, NOW),
    env.DB.prepare("INSERT INTO road_patterns (id, lane, kind, text, is_seeded, created_at) VALUES (?, 'data', 'tip', 't', 0, ?) ON CONFLICT (id) DO NOTHING").bind(`rp-${tag}`, NOW),
    env.DB.prepare("INSERT INTO road_pattern_votes (pattern_id, user_id, created_at) VALUES (?, ?, ?)").bind(`rp-${tag}`, userId, NOW),
    env.DB.prepare("INSERT INTO path_outcomes (id, user_id, lane, role, steps_json, skills_json) VALUES (?, ?, 'data', 'analyst', '[]', '[]')").bind(`po-${tag}`, userId),
    env.DB.prepare("INSERT INTO user_tailored_resumes (id, user_id, posting_id, ciphertext, iv, created_at, updated_at) VALUES (?, ?, 'po', 'c', 'i', ?, ?)").bind(`t-${tag}`, userId, NOW, NOW),
    env.DB.prepare("INSERT INTO user_notifications (id, user_id, kind, dedupe_key, ciphertext, iv, created_at) VALUES (?, ?, 'road_nudge', 'k', 'c', 'i', ?)").bind(`n-${tag}`, userId, NOW),
    env.DB.prepare("INSERT INTO notification_settings (user_id, updated_at) VALUES (?, ?)").bind(userId, NOW),
    env.DB.prepare("INSERT INTO user_connections (user_id, provider, account_id, status, created_at, updated_at) VALUES (?, 'github', ?, 'active', ?, ?)").bind(userId, `ca-${tag}`, NOW, NOW),
    env.DB.prepare("INSERT INTO notification_devices (token, user_id, platform, created_at, updated_at) VALUES (?, ?, 'ios', ?, ?)").bind(`tok-${tag}`, userId, NOW, NOW),
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
    // without a Composio key the GitHub grant can't be revoked there, so it is reported; everything here still goes
    expect(await res.json()).toEqual({ deleted: Object.fromEntries(TABLES.map((t) => [t, 1])), githubLeft: true });

    expect(await rowsFor(idA)).toEqual(TABLES.map((t) => [t, 0]));
    expect(await rowsFor(idB)).toEqual(TABLES.map((t) => [t, 1]));
  });

  it("disconnects GitHub at Composio before erasing", async () => {
    const token = await issueSession(env.SESSION_SECRET);
    const id = await verifySession(token, env.SESSION_SECRET);
    if (!id) throw new Error("token did not verify");
    await seed(id);
    const { calls } = fakeComposio();
    const res = await app.request("/", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }, keyed);
    vi.restoreAllMocks();
    expect(await res.json()).toEqual({ deleted: Object.fromEntries(TABLES.map((t) => [t, t === "user_connections" ? 0 : 1])) });
    expect(calls).toEqual([expect.objectContaining({ method: "DELETE", url: expect.stringContaining(`/connected_accounts/ca-${id.slice(0, 8)}?revoke_on_delete=true`) })]);
    expect(await rowsFor(id)).toEqual(TABLES.map((t) => [t, 0]));
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
