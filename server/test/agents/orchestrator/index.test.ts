import { describe, expect, it } from "vitest";
import { careerAgent } from "../../../src/agents/career/agent";
import { orchestrate, UnknownSkill } from "../../../src/agents/orchestrator";
import { call, fakeDeps, fakeMemory } from "../fakes";

const snapshot = { targetRoles: ["Junior backend developer"], nextSteps: [{ step: "Build one API project", why: "No projects yet." }] };

describe("orchestrate", () => {
  it("runs a skill through the agent that owns it", async () => {
    const { deps, toolNames } = fakeDeps({ memory: fakeMemory(), replies: [call("finish", snapshot)] });
    const result = await orchestrate(deps, { skillId: "career-snapshot", platform: "app", userId: "u1", input: {} });
    expect(result).toMatchObject({ status: "done", output: snapshot });
    expect(toolNames[0]).toEqual(["recall", "company_insights", "github_profile", "connected_apps", "app_read_tools", "app_read", "finish"]);
    for (const name of toolNames[0].filter((n) => n !== "finish")) expect(careerAgent.tools[name]).toBeDefined();
  });

  it("rejects a skill no agent owns, before anything runs", async () => {
    const { deps, prompts } = fakeDeps();
    const error = await orchestrate(deps, { skillId: "nope", platform: "app", userId: "u1", input: {} }).catch((e) => e);
    expect(error).toBeInstanceOf(UnknownSkill);
    expect(error.skillId).toBe("nope");
    expect(prompts).toEqual([]);
  });

  it("still applies the harness checks, e.g. the skill's platforms", async () => {
    const { deps } = fakeDeps();
    await expect(orchestrate(deps, { skillId: "career-snapshot", platform: "vr", userId: "u1", input: {} })).rejects.toMatchObject({ status: 400 });
  });
});
