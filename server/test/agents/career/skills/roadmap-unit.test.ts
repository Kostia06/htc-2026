import { describe, expect, it } from "vitest";
import { careerAgent } from "../../../../src/agents/career/agent";
import { roadmapUnit } from "../../../../src/agents/career/skills/roadmap-unit";
import { runSkill } from "../../../../src/agents/core/harness";
import { call, fakeDeps } from "../../fakes";

const output = {
  title: "First steps",
  summary: "Small things first.",
  steps: Array.from({ length: 3 }, (_, i) => ({ kind: "event", title: `Go to meetup ${i}`, why: "You like people.", estimate: "1 evening", needs: [] })),
};
const request = (input: unknown) => ({ skill: roadmapUnit, tools: careerAgent.tools, platform: "app" as const, userId: "u1", input });

describe("roadmap-unit skill", () => {
  it("plans in one call with the background and earlier steps in the goal", async () => {
    const { deps, conversations, toolNames } = fakeDeps({ replies: [call("finish", output)] });
    const result = await runSkill(deps, request({ goal: "Illustrator", unit: 1, background: "Skill: Procreate", previous: ["Pick three pieces"] }));
    expect(result).toMatchObject({ status: "done", output });
    expect(toolNames[0]).toEqual(["finish"]);
    const goal = conversations[0][0].parts[0].text;
    expect(goal).toContain("unit 2");
    expect(goal).toContain("Procreate");
    expect(goal).toContain("Pick three pieces");
  });

  it("rejects input without a goal", async () => {
    const { deps } = fakeDeps();
    await expect(runSkill(deps, request({ unit: 0 }))).rejects.toMatchObject({ status: 400 });
  });
});
