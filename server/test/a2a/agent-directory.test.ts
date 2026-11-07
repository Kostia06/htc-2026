import { describe, expect, it } from "vitest";
import { agentDirectory } from "../../src/a2a/agent-directory";
import { RpcError } from "../../src/a2a/jsonrpc";
import { call, fakeDeps, fakeMemory } from "../agents/fakes";

const snapshot = { targetRoles: ["Junior backend developer"], nextSteps: [{ step: "Build one API project", why: "No projects yet." }] };

describe("agentDirectory", () => {
  it("only offers skills an outside caller can run as the app", () => {
    const { deps } = fakeDeps();
    const skills = agentDirectory(deps).cards().flatMap((card) => card.skills);
    expect(skills.length).toBeGreaterThan(0);
    for (const skill of skills) expect(skill.platforms).toContain("app");
    expect(skills.map((s) => s.id)).not.toContain("research-company");
  });

  it("runs a skill through the orchestrator and finds the run again for its owner only", async () => {
    const { deps } = fakeDeps({ memory: fakeMemory(), replies: [call("finish", snapshot)] });
    const directory = agentDirectory(deps);

    const run = await directory.run({ skillId: "career-snapshot", userId: "u1", input: {} });
    expect(run).toMatchObject({ status: "done", output: snapshot });

    expect(await directory.findRun(run.runId, "u1")).toMatchObject({ status: "done", output: snapshot });
    expect(await directory.findRun(run.runId, "someone-else")).toBeNull();
  });

  it("hides the internal reason a run failed", async () => {
    const { deps } = fakeDeps({ memory: fakeMemory(), replies: [] });
    const run = await agentDirectory(deps).run({ skillId: "career-snapshot", userId: "u1", input: {} });
    expect(run).toEqual({ status: "failed", runId: expect.any(String), error: "The agent could not finish this task." });
  });

  it("turns a rejected request into an invalid-params error instead of an internal one", async () => {
    const { deps } = fakeDeps();
    const error = await agentDirectory(deps)
      .run({ skillId: "interview-prep", userId: "u1", input: { company: 42 } })
      .catch((e) => e);
    expect(error).toBeInstanceOf(RpcError);
    expect(error.code).toBe(-32602);
  });
});
