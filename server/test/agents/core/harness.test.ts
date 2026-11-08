import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RunRejected, runSkill, startSkill } from "../../../src/agents/core/harness";
import type { Skill } from "../../../src/agents/core/types";
import { readDocumentTool } from "../../../src/agents/resume/tools/read-document";
import { recall } from "../../../src/agents/shared-tools/recall";
import { call, fakeDeps, fakeMemory } from "../fakes";

const skill: Skill<{ company?: string; topic: string }> = {
  name: "test-skill",
  description: "test",
  platforms: ["app", "vr"],
  personal: true,
  tools: ["recall"],
  maxSteps: 3,
  instructions: "Write a summary about the topic.",
  inputSchema: { type: "object", properties: { company: { type: "string" }, topic: { type: "string" } }, required: ["topic"] },
  outputSchema: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"] },
  buildGoal: (input, ctx) => `Summarise ${input.topic}${ctx.company ? ` at ${ctx.company.name}` : ""}.`,
};

const request = (over: Record<string, unknown> = {}) => ({ skill, tools: { recall }, platform: "app" as const, userId: "u1", input: { topic: "SQL" }, ...over });

async function runRow(runId: string) {
  return env.DB.prepare("SELECT * FROM agent_runs WHERE id = ?").bind(runId).first<Record<string, string>>();
}

describe("runSkill", () => {
  beforeEach(async () => {
    await env.DB.prepare("INSERT INTO companies (id, slug, name, website) VALUES ('c1', 'acme', 'Acme', 'https://acme.com')").run();
  });

  it("rejects a skill on a platform it doesn't support, without recording a run", async () => {
    const { deps } = fakeDeps();
    await expect(runSkill(deps, request({ platform: "background" }))).rejects.toMatchObject({ status: 400 });
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM agent_runs").first("n")).toBe(0);
  });

  it("rejects input that doesn't fit the skill's schema", async () => {
    const { deps } = fakeDeps();
    const error = await runSkill(deps, request({ input: { topic: 4 } })).catch((e) => e);
    expect(error).toBeInstanceOf(RunRejected);
    expect(error).toMatchObject({ status: 400, message: "topic must be a string" });
  });

  it("rejects an unknown company", async () => {
    const { deps } = fakeDeps();
    await expect(runSkill(deps, request({ input: { topic: "x", company: "nope" } }))).rejects.toMatchObject({ status: 404 });
  });

  it("rejects a run the skill won't claim, without recording it", async () => {
    const { deps } = fakeDeps();
    const claim = vi.fn(async () => false);
    await expect(runSkill(deps, request({ skill: { ...skill, claim } }))).rejects.toMatchObject({ status: 429 });
    expect(claim).toHaveBeenCalledWith({ topic: "SQL" }, deps.services);
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM agent_runs").first("n")).toBe(0);
  });

  it("resolves the input's company into the run", async () => {
    const { deps, conversations } = fakeDeps({ replies: [call("finish", { summary: "ok" })] });
    await runSkill(deps, request({ input: { topic: "SQL", company: "acme" } }));
    expect(conversations[0][0].parts[0].text).toBe("Summarise SQL at Acme.");
  });

  it("shows the model only the skill's tools plus finish", async () => {
    const { deps, toolNames } = fakeDeps({ replies: [call("finish", { summary: "ok" })] });
    await runSkill(deps, request());
    expect(toolNames[0]).toEqual(["recall", "finish"]);
  });

  it("refuses a tool the skill didn't allow, even if the model asks for it", async () => {
    const { deps, conversations } = fakeDeps({ replies: [call("remember", { kind: "note", text: "x" }), call("finish", { summary: "ok" })] });
    await runSkill(deps, request());
    expect(conversations[1].at(-1)?.parts[0].functionResponse?.response).toEqual({ error: "unknown tool remember" });
  });

  it("builds the prompt from the persona, the skill, the platform style and up to 8 personal memories", async () => {
    const memory = fakeMemory([{ kind: "weakness", text: "Rambles on behavioural answers" }]);
    const { deps, prompts, memoryFor } = fakeDeps({ memory, replies: [call("finish", { summary: "ok" })] });
    await runSkill(deps, request({ platform: "vr" }));
    expect(memoryFor).toHaveBeenCalledWith("u1");
    expect(memory.recall).toHaveBeenCalledWith({ limit: 8 });
    expect(prompts[0]).toContain("career mentor");
    expect(prompts[0]).toContain("Write a summary about the topic.");
    expect(prompts[0]).toContain("read aloud");
    expect(prompts[0]).toContain("[weakness] Rambles on behavioural answers");
  });

  it("binds only tools from the request's toolbox, so a skill can't reach another agent's tool", async () => {
    const { deps, toolNames } = fakeDeps();
    const greedy = { ...skill, tools: ["recall", readDocumentTool.name] };
    const result = await runSkill(deps, request({ skill: greedy }));
    expect(result).toMatchObject({ status: "failed", error: expect.stringContaining("read_document") });
    expect(toolNames).toEqual([]);
  });

  it("never opens private memory for a skill that isn't personal", async () => {
    const { deps, memoryFor, prompts } = fakeDeps({ replies: [call("finish", { summary: "ok" })] });
    await runSkill(deps, request({ skill: { ...skill, personal: false, tools: [] } }));
    expect(memoryFor).not.toHaveBeenCalled();
    expect(prompts[0]).not.toContain("about this person");
  });

  it("records a finished run with its scrubbed output", async () => {
    const { deps } = fakeDeps({ replies: [call("finish", { summary: "Email jo@acme.com" })] });
    const result = await runSkill(deps, request());
    expect(result).toMatchObject({ status: "done", output: { summary: "Email [email]" } });
    const row = await runRow(result.runId);
    expect(row).toMatchObject({ user_id: "u1", skill: "test-skill", platform: "app", status: "done" });
    expect(JSON.parse(row!.output)).toEqual({ summary: "Email [email]" });
    expect(row!.finished_at).toBeTruthy();
  });

  it("lets the skill correct the output from what the tools really did", async () => {
    const finalize = vi.fn((output: Record<string, unknown>, toolCalls: unknown[]) => ({ ...output, calls: toolCalls.length }));
    const { deps } = fakeDeps({ replies: [call("recall"), call("finish", { summary: "ok" })] });
    const result = await runSkill(deps, request({ skill: { ...skill, finalize } }));
    expect(result).toMatchObject({ output: { summary: "ok", calls: 2 } });
  });

  it("fails the run cleanly when the model never calls finish", async () => {
    const { deps } = fakeDeps({ replies: [call("recall"), call("recall"), call("recall")] });
    const result = await runSkill(deps, request());
    expect(result).toMatchObject({ status: "failed", error: "the agent did not call finish within 3 steps" });
    expect(await runRow(result.runId)).toMatchObject({ status: "failed", error: "the agent did not call finish within 3 steps" });
  });

  it("fails the run cleanly when the model errors", async () => {
    const { deps } = fakeDeps({
      model: () => async () => {
        throw new Error("gemini 500");
      },
    });
    const result = await runSkill(deps, request());
    expect(result).toMatchObject({ status: "failed", error: "gemini 500" });
  });

  it("records the run as running before it finishes", async () => {
    const { deps } = fakeDeps({ replies: [call("finish", { summary: "ok" })] });
    const { runId, result } = await startSkill(deps, request());
    expect(await runRow(runId)).toMatchObject({ status: "running" });
    await result;
    expect(await runRow(runId)).toMatchObject({ status: "done" });
  });
});
