import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { feedRouter } from "../../src/api/feed";
import { issueSession, requireSession, verifySession } from "../../src/auth/session";
import type { AppContext } from "../../src/env";
import type { JobPosting, JobQuery } from "../../src/integrations/adzuna";
import { ADZUNA_ATTRIBUTION } from "../../src/integrations/adzuna";
import { updateProfile } from "../../src/memory/profile/store";

const posting = (id: string, title: string): JobPosting => ({
  title,
  company: "Acme",
  location: "Calgary, Alberta",
  posted_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  description: "React and TypeScript",
  url: `https://www.adzuna.ca/details/${id}`,
  ...ADZUNA_ATTRIBUTION,
});

let searches: JobQuery[] = [];
const searchJobs = async (query: JobQuery) => {
  searches.push(query);
  return Array.from({ length: 25 }, (_, i) => posting(`${query.what.length}-${i}`, `${query.what} ${i}`));
};

const app = new Hono<AppContext>();
app.use("*", requireSession);
app.route("/", feedRouter(() => ({ searchJobs })));

// stands in for the Workers execution context so the background rebuild can be awaited
function backgroundWork() {
  const pending: Promise<unknown>[] = [];
  const ctx = { waitUntil: (p: Promise<unknown>) => void pending.push(p), passThroughOnException() {}, props: {} } as unknown as ExecutionContext;
  return { ctx, settle: () => Promise.all(pending) };
}

type Item = { id: string; kind: string; title: string; why: string; source: string; attribution?: unknown };
type Page = { items: Item[]; nextCursor: string | null; building: boolean; builtAt: string | null; section: string };

async function getFeed(token: string, cursor?: string, section?: string, refresh = false) {
  const query = new URLSearchParams();
  if (cursor !== undefined) query.set("cursor", cursor);
  if (section !== undefined) query.set("section", section);
  if (refresh) query.set("refresh", "1");
  const work = backgroundWork();
  const res = await app.request(`/?${query}`, { headers: { Authorization: `Bearer ${token}` } }, env, work.ctx);
  await work.settle();
  return { status: res.status, body: (await res.json()) as Page };
}

async function person(targetRoles: string[]) {
  const token = await issueSession(env.SESSION_SECRET);
  const id = (await verifySession(token, env.SESSION_SECRET))!;
  await updateProfile(env, id, { targetRoles, skills: [{ name: "React", source: "self-reported" }] });
  return { token, id };
}

// the profile is dated earlier too, or the feed would count as stale for being older than the profile
const builtAgo = (userId: string, minutes: number) => {
  const at = (extra: number) => new Date(Date.now() - (minutes + extra) * 60_000).toISOString();
  return env.DB.batch([
    env.DB.prepare("UPDATE feed_state SET built_at = ? WHERE user_id = ?").bind(at(0), userId),
    env.DB.prepare("UPDATE user_profiles SET updated_at = ? WHERE user_id = ?").bind(at(1), userId),
  ]);
};

beforeEach(async () => {
  searches = [];
  await env.DB.batch([env.DB.prepare("DELETE FROM feed_items"), env.DB.prepare("DELETE FROM feed_state"), env.DB.prepare("DELETE FROM feed_actions")]);
});

describe("GET /api/feed", () => {
  it("answers the first request with an empty building page, then serves the built feed", async () => {
    const { token } = await person(["Junior developer"]);
    expect((await getFeed(token)).body).toEqual({ items: [], nextCursor: null, building: true, builtAt: null, section: "all" });

    const { body } = await getFeed(token);
    expect(body.building).toBe(false);
    expect(body.items).toHaveLength(20);
    expect(body.items[0].why).toBe("Fits your goal: Junior developer");
  });

  it("pages a section by cursor without repeating or skipping cards", async () => {
    const { token } = await person(["Junior developer"]);
    await getFeed(token);
    const first = await getFeed(token, undefined, "jobs");
    const second = await getFeed(token, first.body.nextCursor!, "jobs");
    expect(first.body.nextCursor).toBe("20");
    expect(second.body.items).toHaveLength(5);
    expect(second.body.nextCursor).toBeNull();
    expect(new Set([...first.body.items, ...second.body.items].map((i) => i.id)).size).toBe(25);
  });

  it("rejects a cursor it didn't hand out", async () => {
    const { token } = await person(["Junior developer"]);
    expect((await getFeed(token, "-1")).status).toBe(400);
  });

  it("labels every job with Adzuna's attribution, linked to adzuna.ca", async () => {
    const { token } = await person(["Junior developer"]);
    await getFeed(token);
    const { body } = await getFeed(token, undefined, "jobs");
    for (const item of body.items) {
      expect(item.source).toBe("Adzuna");
      expect(item.attribution).toEqual({ label: "Jobs by Adzuna", url: "https://www.adzuna.ca" });
    }
  });

  it("serves a fresh feed without searching again, and rebuilds in the background once its jobs are over an hour old", async () => {
    const { token, id } = await person(["Junior developer"]);
    await getFeed(token);
    await builtAgo(id, 50);
    await getFeed(token);
    expect(searches).toHaveLength(1);

    await builtAgo(id, 61);
    const stale = await getFeed(token);
    expect(stale.body.items).toHaveLength(20);
    expect(stale.body.building).toBe(true);
    expect(searches).toHaveLength(2);
  });

  it("rebuilds on pull to refresh unless the feed was built moments ago", async () => {
    const { token, id } = await person(["Junior developer"]);
    await getFeed(token);
    await getFeed(token, undefined, undefined, true);
    expect(searches).toHaveLength(1);

    await builtAgo(id, 10);
    const pulled = await getFeed(token, undefined, undefined, true);
    expect(pulled.body.building).toBe(true);
    expect(searches).toHaveLength(2);
  });

  it("rebuilds after the profile changes", async () => {
    const { token, id } = await person(["Junior developer"]);
    await getFeed(token);
    await updateProfile(env, id, { targetRoles: ["Nurse"] });
    await getFeed(token);
    expect(searches.map((q) => q.what)).toEqual(["Junior developer", "Junior developer", "Nurse"]);
    const { body } = await getFeed(token);
    expect(body.items.some((i) => i.why === "Fits your goal: Nurse")).toBe(true);
  });

  it("keeps each person's feed to themselves", async () => {
    const a = await person(["Junior developer"]);
    const b = await person(["Nurse"]);
    await getFeed(a.token);
    expect((await getFeed(b.token)).body.items).toEqual([]);
    await getFeed(b.token);
    const titles = (await getFeed(b.token, undefined, "jobs")).body.items.map((i) => i.title);
    expect(titles.every((t) => t.startsWith("Nurse"))).toBe(true);
  });

  it("keeps the old feed and allows a retry when every search fails", async () => {
    const failing = new Hono<AppContext>();
    failing.use("*", requireSession);
    failing.route("/", feedRouter(() => ({ searchJobs: async () => Promise.reject(new Error("Adzuna HTTP 500")) })));
    const { token } = await person(["Junior developer"]);
    const work = backgroundWork();
    await failing.request("/", { headers: { Authorization: `Bearer ${token}` } }, env, work.ctx);
    await work.settle();
    const state = await env.DB.prepare("SELECT built_at, building_since FROM feed_state").first();
    expect(state).toEqual({ built_at: null, building_since: null });
  });
});
