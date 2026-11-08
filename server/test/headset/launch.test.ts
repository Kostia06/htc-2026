import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteExpiredLaunches, deps, parseLaunch, queueLaunch, takeLaunch, waitForLaunch } from "../../src/headset/launch";

const NOW = new Date("2026-11-07T10:00:00.000Z");
const later = (ms: number) => new Date(NOW.getTime() + ms);

describe("sending a practice session to the headset", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM headset_launches").run();
  });

  it("accepts a mode with optional company, role and step, and trims what it keeps", () => {
    expect(parseLaunch({ mode: "interview", companySlug: " atb ", role: "Junior data analyst", stepId: "step-1" })).toEqual({
      mode: "interview",
      companySlug: "atb",
      role: "Junior data analyst",
      stepId: "step-1",
    });
    expect(parseLaunch({ mode: "networking" })).toBeNull();
    expect(parseLaunch({ mode: "karaoke" })).toBeNull();
    expect(parseLaunch({ mode: "interview", role: 42 })).toBeNull();
    expect(parseLaunch(null)).toBeNull();
  });

  it("keeps one pending launch per person for two minutes, the newest winning", async () => {
    await queueLaunch(env, "alice", { mode: "interview" }, NOW);
    const queued = await queueLaunch(env, "alice", { mode: "interview", companySlug: "atb" }, later(1000));
    expect(queued.expiresAt).toBe(later(1000 + 120_000).toISOString());
    expect(await takeLaunch(env, "bob", later(2000))).toBeNull();
    expect(await takeLaunch(env, "alice", later(2000))).toEqual({ mode: "interview", companySlug: "atb" });
    // taken once: the next poll finds nothing
    expect(await takeLaunch(env, "alice", later(3000))).toBeNull();
  });

  it("carries the interview's difficulty and length to the headset", async () => {
    const launch = parseLaunch({ mode: "interview", stepId: "st_1", difficulty: "hard", length: "quick" });
    expect(launch).toEqual({ mode: "interview", stepId: "st_1", difficulty: "hard", length: "quick" });
    expect(parseLaunch({ mode: "interview", difficulty: "brutal" })).toBeNull();
    expect(parseLaunch({ mode: "interview", length: "forever" })).toBeNull();
    await queueLaunch(env, "alice", launch!, NOW);
    expect(await takeLaunch(env, "alice", later(1000))).toEqual(launch);
  });

  it("carries a past session to review in the headset", async () => {
    expect(parseLaunch({ mode: "interview", reviewSessionId: " s_1 " })).toEqual({ mode: "interview", reviewSessionId: "s_1" });
    expect(parseLaunch({ mode: "interview", reviewSessionId: 7 })).toBeNull();
    await queueLaunch(env, "alice", { mode: "interview", reviewSessionId: "s_1" }, NOW);
    expect(await takeLaunch(env, "alice", later(1000))).toEqual({ mode: "interview", reviewSessionId: "s_1" });
  });

  it("never hands out a launch that has expired", async () => {
    await queueLaunch(env, "alice", { mode: "interview" }, NOW);
    expect(await takeLaunch(env, "alice", later(121_000))).toBeNull();
    await queueLaunch(env, "alice", { mode: "interview" }, NOW);
    expect(await deleteExpiredLaunches(env, later(121_000))).toBe(1);
  });

  it("long-polls until a launch shows up or the wait runs out", async () => {
    const sleeps: number[] = [];
    vi.spyOn(deps, "sleep").mockImplementation(async (ms) => {
      sleeps.push(ms);
      if (sleeps.length === 2) await queueLaunch(env, "alice", { mode: "interview", role: "Analyst" }, NOW);
    });
    const clock = { now: NOW.getTime() };
    const now = () => new Date((clock.now += 1500));
    expect(await waitForLaunch(env, "alice", 20_000, now)).toEqual({ mode: "interview", role: "Analyst" });
    expect(sleeps.length).toBe(2);

    sleeps.length = 0;
    expect(await waitForLaunch(env, "bob", 5_000, now)).toBeNull();
    expect(sleeps.length).toBeGreaterThan(0);
    expect(sleeps.length).toBeLessThanOrEqual(4);
  });
});
