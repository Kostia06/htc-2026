import { describe, expect, it } from "vitest";
import { PLATFORMS } from "../../../src/agents/core/types";
import { skills } from "../../../src/agents/skills";
import { tools } from "../../../src/agents/tools";

describe("skill registry", () => {
  it("has the four skills, keyed by name", () => {
    expect(Object.keys(skills).sort()).toEqual(["career-snapshot", "interview-debrief", "interview-prep", "research-company"]);
    for (const [key, skill] of Object.entries(skills)) expect(skill.name).toBe(key);
  });

  it("only allows registered tools and known platforms", () => {
    for (const skill of Object.values(skills)) {
      for (const name of skill.tools) expect(tools[name], `${skill.name} uses ${name}`).toBeDefined();
      for (const platform of skill.platforms) expect(PLATFORMS).toContain(platform);
    }
  });

  it("keeps private memory tools out of skills that aren't personal", () => {
    for (const skill of Object.values(skills).filter((s) => !s.personal)) {
      expect(skill.tools).not.toContain("recall");
      expect(skill.tools).not.toContain("remember");
    }
  });
});
