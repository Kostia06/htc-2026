import { describe, expect, it } from "vitest";
import { careerAgent } from "../../../src/agents/career/agent";
import { careerSnapshot } from "../../../src/agents/career/skills/career-snapshot";
import { defineAgent } from "../../../src/agents/core/agent";
import { agentCard } from "../../../src/agents/core/card";
import { readDocumentTool } from "../../../src/agents/resume/tools/read-document";

const about = { name: "career", description: "Where you stand." };
const careerTools = () => Object.values(careerAgent.tools);

describe("defineAgent", () => {
  it("keys skills and tools by name", () => {
    const agent = defineAgent(agentCard(about, [careerSnapshot]), [careerSnapshot], careerTools());
    expect(Object.keys(agent.skills)).toEqual(["career-snapshot"]);
    for (const [name, tool] of Object.entries(agent.tools)) expect(tool.name).toBe(name);
  });

  it("refuses a skill that wants a tool another agent owns", () => {
    const greedy = { ...careerSnapshot, tools: [...careerSnapshot.tools, readDocumentTool.name] };
    expect(() => defineAgent(agentCard(about, [greedy]), [greedy], careerTools())).toThrow(/read_document/);
  });

  it("refuses a card that lists different skills", () => {
    expect(() => defineAgent(agentCard(about, []), [careerSnapshot], careerTools())).toThrow(/card/);
  });
});
