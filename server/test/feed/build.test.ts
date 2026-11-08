import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildFeed, rebuildStaleFeeds } from "../../src/feed/build";
import { cachedJobSearch } from "../../src/feed/jobs";
import type { JobQuery } from "../../src/integrations/adzuna";
import { updateProfile } from "../../src/memory/profile/store";

const keyed = { ...env, ADZUNA_APP_ID: "app123", ADZUNA_APP_KEY: "secret456" };
const raw = { id: "501", title: "Junior Developer", company: { display_name: "Acme" }, location: { display_name: "Calgary" }, created: "2026-11-01T00:00:00Z", description: "React" };

beforeEach(async () => {
  await env.DB.batch([env.DB.prepare("DELETE FROM feed_items"), env.DB.prepare("DELETE FROM feed_state")]);
});
afterEach(() => vi.restoreAllMocks());

describe("feed building", () => {
  it("shares one Adzuna call between people with the same search and stores no profile text in the cache", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ results: [raw] }));
    const search = cachedJobSearch(keyed);
    await search({ what: "Junior developer", where: "Calgary" });
    await search({ what: "junior developer", where: "calgary" });
    expect(spy).toHaveBeenCalledTimes(1);

    const { results } = await env.DB.prepare("SELECT key FROM cache WHERE key LIKE 'feed:jobs:%'").all<{ key: string }>();
    expect(results).toHaveLength(1);
    expect(results[0].key).not.toMatch(/developer|calgary/i);
  });

  it("searches once per target role, at most three", async () => {
    const queries: JobQuery[] = [];
    await updateProfile(env, "u1", { targetRoles: ["A role", "B role", "C role", "D role"] });
    await buildFeed(env, "u1", { searchJobs: async (q) => (queries.push(q), []) });
    expect(queries.map((q) => q.what)).toEqual(["A role", "B role", "C role"]);
  });

  it("falls back to top skills when there is no role, and searches nothing for an empty profile", async () => {
    const queries: JobQuery[] = [];
    const sources = { searchJobs: async (q: JobQuery) => (queries.push(q), []) };
    await updateProfile(env, "u2", { skills: [{ name: "Python", source: "resume" }, { name: "SQL", source: "resume" }] });
    await buildFeed(env, "u2", sources);
    await buildFeed(env, "nobody", sources);
    expect(queries.map((q) => q.what)).toEqual(["Python SQL"]);
  });

  it("the cron rebuilds only feeds older than six hours", async () => {
    const old = new Date(Date.now() - 7 * 3_600_000).toISOString();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO feed_state (user_id, built_at) VALUES ('stale', ?)").bind(old),
      env.DB.prepare("INSERT INTO feed_state (user_id, built_at) VALUES ('fresh', ?)").bind(new Date().toISOString()),
    ]);
    await updateProfile(env, "stale", { targetRoles: ["Nurse"] });
    await updateProfile(env, "fresh", { targetRoles: ["Chef"] });
    const queries: string[] = [];
    await rebuildStaleFeeds(env, { searchJobs: async (q) => (queries.push(q.what), []) });
    expect(queries).toEqual(["Nurse"]);
  });
});
