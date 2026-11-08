import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimResearch, startResearch } from "../../../src/agents/background";
import type { Declaration } from "../../../src/agents/core/loop";
import type { AgentDeps } from "../../../src/agents/core/types";
import { orchestrate } from "../../../src/agents/orchestrator";
import type { GeminiContent } from "../../../src/integrations/gemini";
import { call, fakeDeps, fakeMemory, fakeServices } from "../fakes";
import { fixtures } from "./fixtures";

beforeEach(async () => {
  await env.DB.prepare("INSERT INTO companies (id, slug, name, website, tracked) VALUES ('c1', 'acme', 'Acme', 'https://acme.com', 0)").run();
});

const runs = async (userId: string) =>
  (await env.DB.prepare("SELECT skill, platform, status FROM agent_runs WHERE user_id = ? ORDER BY skill").bind(userId).all()).results;

// answers by toolset, since the user's skill and the research it hands off run at the same time
function routedModel(seen: string[][]) {
  return () => async (_contents: GeminiContent[], declarations: Declaration[]) => {
    const names = declarations.map((d) => d.name);
    seen.push(names);
    return names.includes("save_fact") ? call("finish", { summary: "researched" }) : call("finish", fixtures["interview-prep"].output);
  };
}

describe("research handoff, with the real background research", () => {
  function liveishDeps(seen: string[][]) {
    const deps: AgentDeps = { env, model: routedModel(seen), memoryFor: () => fakeMemory(), services: fakeServices() };
    const pending: Promise<unknown>[] = [];
    deps.services.claimResearch = (slug) => claimResearch(env, slug);
    deps.services.startResearch = vi.fn(async (slug: string) => {
      const started = await startResearch(deps, slug);
      if (started) pending.push(started.result);
      return started !== null;
    });
    return { deps, pending };
  }

  it("interview prep for a company with no fresh facts researches it in the background, once", async () => {
    const seen: string[][] = [];
    const { deps, pending } = liveishDeps(seen);
    const prep = await orchestrate(deps, { skillId: "interview-prep", platform: "app", userId: "u1", input: { company: "acme" } });
    await Promise.all(pending);
    expect(prep.status).toBe("done");
    expect(await runs("background")).toEqual([{ skill: "research-company", platform: "background", status: "done" }]);
    expect(seen.find((names) => names.includes("save_fact"))).toEqual(["company_facts", "web_search", "fetch_page", "save_fact", "finish"]);

    // the second request lands inside the cooldown: no second research run
    await orchestrate(deps, { skillId: "interview-prep", platform: "vr", userId: "u2", input: { company: "acme" } });
    await Promise.all(pending);
    expect(await runs("background")).toHaveLength(1);
  });

  it("skips research when facts are fresh, and never for skills that don't need it", async () => {
    await env.DB.prepare(
      "INSERT INTO company_facts (id, company_id, kind, text, source_url, fetched_at, content_hash) VALUES ('f1', 'c1', 'about', 'Acme builds rockets.', 'https://acme.com', ?, 'h1')",
    )
      .bind(new Date().toISOString())
      .run();
    const { deps } = fakeDeps({ replies: [call("finish", fixtures["interview-prep"].output), call("finish", fixtures["resume-coach"].output)] });
    await orchestrate(deps, { skillId: "interview-prep", platform: "app", userId: "u1", input: { company: "acme" } });
    await orchestrate(deps, { skillId: "resume-coach", platform: "app", userId: "u1", input: { ...fixtures["resume-coach"].input, company: "acme" } });
    expect(deps.services.startResearch).not.toHaveBeenCalled();
  });

  it("hands nothing off when the request is rejected", async () => {
    const { deps } = fakeDeps();
    await expect(orchestrate(deps, { skillId: "interview-prep", platform: "app", userId: "u1", input: { company: "nowhere" } })).rejects.toMatchObject({ status: 404 });
    expect(deps.services.startResearch).not.toHaveBeenCalled();
  });
});

describe("per-user isolation", () => {
  it("binds private memory to the user the task is for, both reading and writing", async () => {
    const memories = { u1: fakeMemory([{ kind: "goal", text: "u1 wants nursing" }]), u2: fakeMemory([{ kind: "goal", text: "u2 wants welding" }]) };
    const debrief = fixtures["interview-debrief"];
    const { deps, prompts, conversations } = fakeDeps({
      replies: [call("recall", {}), call("remember", { kind: "weakness", text: "rambles on STAR answers" }), call("finish", debrief.output)],
    });
    deps.memoryFor = vi.fn((userId: string) => memories[userId as "u1" | "u2"]);
    const run = await orchestrate(deps, { skillId: "interview-debrief", platform: "app", userId: "u2", input: debrief.input });

    expect(run.status).toBe("done");
    expect(deps.memoryFor).toHaveBeenCalledWith("u2");
    expect(deps.memoryFor).not.toHaveBeenCalledWith("u1");
    expect(prompts[0]).toContain("u2 wants welding");
    expect(JSON.stringify([prompts, conversations])).not.toContain("u1 wants nursing");
    expect(memories.u2.items.map((m) => m.text)).toContain("rambles on STAR answers");
    expect(memories.u1.items.map((m) => m.text)).toEqual(["u1 wants nursing"]);
  });

  it("records every run under its own user and hides it from everyone else", async () => {
    const { deps } = fakeDeps({ replies: [call("finish", fixtures["career-snapshot"].output), call("finish", fixtures["career-snapshot"].output)] });
    await orchestrate(deps, { skillId: "career-snapshot", platform: "app", userId: "u1", input: {} });
    await orchestrate(deps, { skillId: "career-snapshot", platform: "app", userId: "u2", input: {} });
    expect(await runs("u1")).toHaveLength(1);
    expect(await runs("u2")).toHaveLength(1);
  });
});
