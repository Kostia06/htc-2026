import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { orchestrate } from "../../../src/agents/orchestrator";
import { fieldQuestions } from "../../../src/knowledge/interview";
import { atsDos, bulletPatterns } from "../../../src/knowledge/resume";
import { call, fakeDeps } from "../fakes";
import { fixtures } from "./fixtures";

beforeEach(async () => {
  await env.DB.prepare("INSERT INTO companies (id, slug, name, website, tracked) VALUES ('c1', 'acme', 'Acme', 'https://acme.com', 0)").run();
});

describe("curated knowledge reaches the agents", () => {
  it("interview prep can draw on the question bank, and its examples never come out as reported", async () => {
    const banked = fieldQuestions.health.slice(0, 5).map((q) => ({ text: q.text, why: q.shows, reported: true }));
    const { deps } = fakeDeps({ replies: [call("question_bank", { field: "health" }), call("finish", { questions: banked, focus: ["patient safety"] })] });
    const run = await orchestrate(deps, { skillId: "interview-prep", platform: "vr", userId: "u1", input: { company: "acme", role: "registered nurse" } });
    expect(run.status).toBe("done");
    expect(run.toolCalls[0].result).toMatchObject({ example: true, field: "health" });
    if (run.status === "done") expect((run.output.questions as { reported: boolean }[]).every((q) => !q.reported)).toBe(true);
  });

  it("resume coach reads field bullet patterns through resume_playbook", async () => {
    const { deps } = fakeDeps({ replies: [call("resume_playbook", { field: "software" }), call("finish", fixtures["resume-coach"].output)] });
    const run = await orchestrate(deps, { skillId: "resume-coach", platform: "app", userId: "u1", input: fixtures["resume-coach"].input });
    expect(run.status).toBe("done");
    expect(run.toolCalls[0].result).toMatchObject({ bulletPatterns: bulletPatterns.software });
  });

  it("resume tailor carries the ATS checklist in its prompt without any tool call", async () => {
    const { deps, prompts, toolNames } = fakeDeps({ replies: [call("finish", fixtures["resume-tailor"].output)] });
    await orchestrate(deps, { skillId: "resume-tailor", platform: "app", userId: "u1", input: fixtures["resume-tailor"].input });
    expect(toolNames[0]).toEqual(["finish"]);
    expect(prompts[0]).toContain(atsDos[0].rule);
  });
});
