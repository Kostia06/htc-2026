import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import { cached, invalidate } from "../../src/memory/cache";

async function expire(key: string) {
  await env.DB.prepare("UPDATE cache SET expires_at = ? WHERE key = ?").bind(new Date(Date.now() - 1000).toISOString(), key).run();
}

describe("cached", () => {
  it("serves the stored value within the ttl without loading again", async () => {
    const load = vi.fn(async () => ({ score: 42 }));
    expect(await cached(env, "insights:acme", 60, load)).toEqual({ score: 42 });
    expect(await cached(env, "insights:acme", 60, load)).toEqual({ score: 42 });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("loads again once the value has expired", async () => {
    const load = vi.fn(async () => "fresh");
    await cached(env, "insights:acme", 60, load);
    await expire("insights:acme");
    await cached(env, "insights:acme", 60, load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("drops every key under a prefix and nothing else", async () => {
    const load = vi.fn(async () => 1);
    await cached(env, "insights:acme", 60, load);
    await cached(env, "insights:acme:dev", 60, load);
    await cached(env, "postings:acme", 60, load);

    await invalidate(env, "insights:");

    const { results } = await env.DB.prepare("SELECT key FROM cache").all<{ key: string }>();
    expect(results.map((r) => r.key)).toEqual(["postings:acme"]);
  });

  it("treats LIKE wildcards in the prefix literally", async () => {
    await cached(env, "a_b", 60, async () => 1);
    await cached(env, "axb", 60, async () => 1);
    await invalidate(env, "a_");

    const { results } = await env.DB.prepare("SELECT key FROM cache").all<{ key: string }>();
    expect(results.map((r) => r.key)).toEqual(["axb"]);
  });
});
