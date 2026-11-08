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
  posted_at: "2026-11-01T10:00:00Z",
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

async function getFeed(token: string, cursor?: string) {
  const work = backgroundWork();
  const res = await app.request(cursor === undefined ? "/" : `/?cursor=${cursor}`, { headers: { Authorization: `Bearer ${token}` } }, env, work.ctx);
  await work.settle();
  return { status: res.status, body: (await res.json()) as { items: { id: string; title: string; why: string; source: string; attribution?: unknown }[]; nextCursor: string | null; building: boolean; builtAt: string | null } };
}

async function person(targetRoles: string[]) {
  const token = await issueSession(env.SESSION_SECRET);
  const id = (await verifySession(token, env.SESSION_SECRET))!;
  await updateProfile(env, id, { targetRoles, skills: [{ name: "React", source: "self-reported" }] });
  return { token, id };
}

beforeEach(async () => {
  searches = [];
  await env.DB.batch([env.DB.prepare("DELETE FROM feed_items"), env.DB.prepare("DELETE FROM feed_state")]);
});

describe("GET /api/feed", () => {
  it("answers the first request with an empty building page, then serves the built feed", async () => {
    const { token } = await person(["Junior developer"]);
    expect((await getFeed(token)).body).toEqual({ items: [], nextCursor: null, building: true, builtAt: null });

    const { body } = await getFeed(token);
    expect(body.building).toBe(false);
    expect(body.items).toHaveLength(20);
    expect(body.items[0].why).toBe("Fits your goal: Junior developer");
  });

  it("pages by cursor without repeating or skipping cards", async () => {
    const { token } = await person(["Junior developer"]);
    await getFeed(token);
    const first = await getFeed(token);
    const second = await getFeed(token, first.body.nextCursor!);
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
    const { body } = await getFeed(token);
    for (const item of body.items) {
      expect(item.source).toBe("Adzuna");
      expect(item.attribution).toEqual({ label: "Jobs by Adzuna", url: "https://www.adzuna.ca" });
    }
  });

  it("serves a fresh feed without searching again, and rebuilds once it is over six hours old", async () => {
    const { token, id } = await person(["Junior developer"]);
    await getFeed(token);
    await getFeed(token);
    expect(searches).toHaveLength(1);

    await env.DB.prepare("UPDATE feed_state SET built_at = ? WHERE user_id = ?").bind(new Date(Date.now() - 7 * 3_600_000).toISOString(), id).run();
    const stale = await getFeed(token);
    expect(stale.body.items).toHaveLength(20);
    expect(stale.body.building).toBe(true);
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
    const titles = (await getFeed(b.token)).body.items.map((i) => i.title);
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
