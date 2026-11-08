import { describe, expect, it } from "vitest";
import { careerAgent } from "../../../../src/agents/career/agent";
import { roadmapSteps } from "../../../../src/agents/career/skills/roadmap-steps";
import { runSkill } from "../../../../src/agents/core/harness";
import { call, fakeDeps } from "../../fakes";

const output = {
  steps: Array.from({ length: 3 }, (_, i) => ({
    kind: "event",
    title: `Go to meetup ${i}`,
    why: "You like people.",
    detail: "Find one this month and go.",
    estimate: "1 evening",
    needs: [],
  })),
};
const request = (input: unknown) => ({ skill: roadmapSteps, tools: careerAgent.tools, platform: "app" as const, userId: "u1", input });

describe("roadmap-steps skill", () => {
  it("writes the steps in one call with the background and earlier steps in the goal", async () => {
    const { deps, conversations, toolNames } = fakeDeps({ replies: [call("finish", output)] });
    const result = await runSkill(deps, request({ goal: "Illustrator", count: 3, background: "Skill: Procreate", previous: ["Pick three pieces"] }));
    expect(result).toMatchObject({ status: "done", output });
    expect(toolNames[0]).toEqual(["finish"]);
    const goal = conversations[0][0].parts[0].text;
    expect(goal).toContain("next 3 steps");
    expect(goal).toContain("Procreate");
    expect(goal).toContain("Pick three pieces");
  });

  it("rejects input without a goal or count", async () => {
    const { deps } = fakeDeps();
    await expect(runSkill(deps, request({ count: 3 }))).rejects.toMatchObject({ status: 400 });
    await expect(runSkill(deps, request({ goal: "Illustrator" }))).rejects.toMatchObject({ status: 400 });
  });
});
