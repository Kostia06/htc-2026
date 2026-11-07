import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { claimCooldown } from "../../src/memory/cooldowns";
import { claimFetchSlot } from "../../src/memory/host-fetches";

const at = (iso: string) => new Date(iso);

describe("crawl-delay slots", () => {
  it("lets a host with no delay be fetched any time", async () => {
    expect(await claimFetchSlot(env, "acme.com", 0)).toBe(true);
    expect(await claimFetchSlot(env, "acme.com", 0)).toBe(true);
  });

  it("refuses a second fetch from the same host inside its delay, then allows it after", async () => {
    expect(await claimFetchSlot(env, "news.ycombinator.com", 30, at("2026-11-07T12:00:00Z"))).toBe(true);
    expect(await claimFetchSlot(env, "news.ycombinator.com", 30, at("2026-11-07T12:00:10Z"))).toBe(false);
    expect(await claimFetchSlot(env, "dev.to", 30, at("2026-11-07T12:00:10Z"))).toBe(true);
    expect(await claimFetchSlot(env, "news.ycombinator.com", 30, at("2026-11-07T12:00:31Z"))).toBe(true);
  });

  it("only lets one of two racing fetches through", async () => {
    const now = at("2026-11-07T12:00:00Z");
    const results = await Promise.all([claimFetchSlot(env, "jobs.acme.com", 5, now), claimFetchSlot(env, "jobs.acme.com", 5, now)]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});

describe("cooldowns", () => {
  const DAY = 86_400_000;

  it("allows one run per key per cooldown, independently per scope", async () => {
    expect(await claimCooldown(env, "interview-intel", "acme", DAY, at("2026-11-07T00:00:00Z"))).toBe(true);
    expect(await claimCooldown(env, "interview-intel", "acme", DAY, at("2026-11-07T20:00:00Z"))).toBe(false);
    expect(await claimCooldown(env, "interview-intel", "globex", DAY, at("2026-11-07T20:00:00Z"))).toBe(true);
    expect(await claimCooldown(env, "other", "acme", DAY, at("2026-11-07T20:00:00Z"))).toBe(true);
    expect(await claimCooldown(env, "interview-intel", "acme", DAY, at("2026-11-08T00:00:01Z"))).toBe(true);
  });
});
