import { describe, expect, it } from "vitest";
import { runSkill } from "../../../../src/agents/core/harness";
import { careerSnapshot } from "../../../../src/agents/career/skills/career-snapshot";
import { call, fakeDeps, fakeMemory } from "../../fakes";

const output = { targetRoles: ["Junior backend developer"], nextSteps: [{ step: "Build one API project", why: "You list Node but no projects." }] };
const request = (input: unknown, platform: "app" | "vr" = "app") => ({ skill: careerSnapshot, platform, userId: "u1", input });

describe("career-snapshot skill", () => {
  it("runs on the app only", async () => {
    const { deps } = fakeDeps();
    await expect(runSkill(deps, request({}, "vr"))).rejects.toMatchObject({ status: 400 });
  });

  it("returns target roles and next steps from the person's goals, skills and target companies", async () => {
    const memory = fakeMemory([{ kind: "goal", text: "Backend work in Calgary" }]);
    const { deps, conversations, toolNames } = fakeDeps({
      memory,
      replies: [call("recall", { kinds: ["goal", "skill"] }), call("company_insights", { company: "acme" }), call("finish", output)],
    });
    const result = await runSkill(deps, request({ companies: ["acme"] }));
    expect(result).toMatchObject({ status: "done", output });
    expect(toolNames[0]).toEqual(["recall", "company_insights", "finish"]);
    expect(conversations[0][0].parts[0].text).toContain("acme");
  });
});
