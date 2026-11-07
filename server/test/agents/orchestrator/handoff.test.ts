import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimResearch, startResearch } from "../../../src/agents/background";
import { RUN_LIMITS } from "../../../src/agents/core/budget";
import type { Model } from "../../../src/agents/core/loop";
import type { AgentDeps, RunResult } from "../../../src/agents/core/types";
import { FACTS_FRESH_DAYS } from "../../../src/agents/orchestrator/handoff";
import { orchestrate } from "../../../src/agents/orchestrator";
import { call, fakeDeps, fakeMemory, fakeServices } from "../fakes";

const DAY_MS = 86_400_000;
const prep = { skillId: "interview-prep", platform: "app" as const, userId: "u1", input: { company: "acme" } };

async function addFact(ageDays: number) {
  await env.DB.prepare("INSERT INTO company_facts (id, company_id, kind, text, source_url, fetched_at, content_hash) VALUES (?, 'c1', 'about', 'Acme makes anvils.', 'https://acme.com', ?, ?)")
    .bind(crypto.randomUUID(), new Date(Date.now() - ageDays * DAY_MS).toISOString(), crypto.randomUUID())
    .run();
}

async function researchRuns() {
  const row = await env.DB.prepare("SELECT count(*) AS n FROM agent_runs WHERE skill = 'research-company'").first<{ n: number }>();
  return row?.n ?? 0;
}

// the live wiring: handed-off research goes through background.startResearch with the real cooldown claim
function wireResearch(deps: AgentDeps, researchDeps: AgentDeps = deps) {
  const running: Promise<RunResult>[] = [];
  const startResearchSpy = vi.fn(async (slug: string) => {
    const started = await startResearch(researchDeps, slug);
    if (started) running.push(started.result);
    return started !== null;
  });
  const services = fakeServices({ claimResearch: (slug) => claimResearch(env, slug), startResearch: startResearchSpy });
  deps.services = services;
  researchDeps.services = services;
  return { running, startResearchSpy };
}

describe("research handoff", () => {
  beforeEach(async () => {
    await env.DB.prepare("INSERT INTO companies (id, slug, name, website) VALUES ('c1', 'acme', 'Acme', 'https://acme.com')").run();
  });

  it("queues research before interview prep when the company has no facts", async () => {
    const { deps } = fakeDeps();
    await orchestrate(deps, prep);
    expect(deps.services.startResearch).toHaveBeenCalledWith("acme");
  });

  it("queues research before interview intel too", async () => {
    const { deps } = fakeDeps();
    await orchestrate(deps, { skillId: "interview-intel", platform: "background", userId: "background", input: { company: "acme" } });
    expect(deps.services.startResearch).toHaveBeenCalledWith("acme");
  });

  it("queues research when the newest fact is older than the freshness window", async () => {
    await addFact(FACTS_FRESH_DAYS + 1);
    const { deps } = fakeDeps();
    await orchestrate(deps, prep);
    expect(deps.services.startResearch).toHaveBeenCalledWith("acme");
  });

  it("leaves a company with fresh facts alone", async () => {
    await addFact(FACTS_FRESH_DAYS + 1);
    await addFact(1);
    const { deps } = fakeDeps();
    await orchestrate(deps, prep);
    expect(deps.services.startResearch).not.toHaveBeenCalled();
  });

  it("hands nothing off for skills without a rule, so research never chains into more research", async () => {
    const { deps } = fakeDeps();
    await orchestrate(deps, { skillId: "career-snapshot", platform: "app", userId: "u1", input: {} });
    await orchestrate(deps, { skillId: "research-company", platform: "background", userId: "background", input: { company: "acme" } });
    expect(deps.services.startResearch).not.toHaveBeenCalled();
  });

  it("hands nothing off when the request itself is rejected", async () => {
    const { deps } = fakeDeps();
    await expect(orchestrate(deps, { ...prep, input: { company: "nope" } })).rejects.toMatchObject({ status: 404 });
    expect(deps.services.startResearch).not.toHaveBeenCalled();
  });

  it("does not hold up the user's run while research is still going", async () => {
    const { deps } = fakeDeps();
    const { deps: researchDeps } = fakeDeps({ model: () => () => new Promise(() => {}) });
    const { running } = wireResearch(deps, researchDeps);
    const result = await orchestrate(deps, prep);
    expect(result.status).toBe("failed"); // the scripted model ran out of replies; what matters is that it returned
    expect(running).toHaveLength(1);
    expect(await researchRuns()).toBe(1);
  });

  it("starts research at most once per company within the cooldown", async () => {
    const { deps } = fakeDeps();
    const { running, startResearchSpy } = wireResearch(deps);
    await orchestrate(deps, prep);
    await orchestrate(deps, prep);
    await Promise.all(running);
    expect(startResearchSpy).toHaveBeenCalledTimes(2);
    expect(await researchRuns()).toBe(1);
  });

  it("keeps the user's private memory out of the handed-off research", async () => {
    const memory = fakeMemory([{ kind: "weakness", text: "freezes on SQL joins" }]);
    const { deps, prompts, memoryFor } = fakeDeps({ memory });
    const { running } = wireResearch(deps);
    await orchestrate(deps, prep);
    await Promise.all(running);
    const research = prompts.filter((p) => p.includes("Research one employer"));
    expect(research).toHaveLength(1);
    expect(research[0]).not.toContain("SQL joins");
    expect(prompts.some((p) => p.includes("SQL joins"))).toBe(true);
    expect(memoryFor.mock.calls).toEqual([["u1"]]);
  });

  it("bounds the handed-off research by the same per-run budget", async () => {
    const searchEveryStep: Model = async () => ({ role: "model", parts: Array.from({ length: 4 }, () => call("web_search", { query: "acme" }).parts[0]) });
    const { deps } = fakeDeps();
    const { deps: researchDeps } = fakeDeps({ model: () => searchEveryStep });
    const { running } = wireResearch(deps, researchDeps);
    await orchestrate(deps, prep);
    await Promise.all(running);
    expect(researchDeps.services.search).toHaveBeenCalledTimes(RUN_LIMITS.totalCalls);
  });
});
