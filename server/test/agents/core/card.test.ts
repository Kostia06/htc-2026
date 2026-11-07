import { describe, expect, it } from "vitest";
import { agentCard } from "../../../src/agents/core/card";
import { interviewPrep } from "../../../src/agents/interview/skills/interview-prep";

describe("agentCard", () => {
  it("describes each skill from the skill itself", () => {
    const card = agentCard({ name: "interview", description: "Gets you ready." }, [interviewPrep]);
    expect(card).toEqual({
      name: "interview",
      description: "Gets you ready.",
      skills: [
        {
          id: "interview-prep",
          name: "Interview prep",
          description: interviewPrep.description,
          platforms: ["app", "vr"],
          inputSchema: interviewPrep.inputSchema,
        },
      ],
    });
  });
});
