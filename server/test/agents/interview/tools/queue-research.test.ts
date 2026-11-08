import { describe, expect, it, vi } from "vitest";
import { queueResearch } from "../../../../src/agents/interview/tools/queue-research";
import { fakeServices, toolContext } from "../../fakes";

describe("queue_research", () => {
  it("starts research on the run's company in the background", async () => {
    const ctx = toolContext();
    expect(await queueResearch.run({}, ctx)).toEqual({ queued: true });
    expect(ctx.services.startResearch).toHaveBeenCalledWith("acme");
  });

  it("says so while the company is on cooldown", async () => {
    const ctx = toolContext({ services: fakeServices({ startResearch: vi.fn(async () => false) }) });
    expect(await queueResearch.run({}, ctx)).toEqual({ queued: false, reason: "researched recently" });
  });

  it("can queue another company by slug", async () => {
    const ctx = toolContext({ company: undefined });
    await queueResearch.run({ company: "globex" }, ctx);
    expect(ctx.services.startResearch).toHaveBeenCalledWith("globex");
  });
});
