import { describe, expect, it } from "vitest";
import { resumePlaybook } from "../../../../src/agents/resume/tools/resume-playbook";
import { bulletPatterns } from "../../../../src/knowledge/resume/bullets";
import { toolContext } from "../../fakes";

type Playbook = Record<string, unknown> & { bulletPatterns?: unknown[]; sectionOrder?: { stage: string }; actionVerbs?: unknown[] };

describe("resume_playbook tool", () => {
  it("gives the field's bullet patterns, verbs and common mistakes by default", async () => {
    const out = (await resumePlaybook.run({ field: "data" }, toolContext())) as Playbook;
    expect(out.bulletPatterns).toEqual(bulletPatterns.data);
    expect(out.actionVerbs?.length).toBeGreaterThan(5);
    expect(out.commonMistakes).toBeDefined();
    expect(out.ats).toBeUndefined();
  });

  it("returns the section order for a career stage and the ATS rules when asked", async () => {
    const out = (await resumePlaybook.run({ field: "trades", stage: "apprentice", topics: ["sections", "ats"] }, toolContext())) as Playbook;
    expect(out.sectionOrder?.stage).toBe("apprentice");
    expect(out.ats).toMatchObject({ dos: expect.any(Array), donts: expect.any(Array) });
    expect(out.bulletPatterns).toBeUndefined();
  });

  it("rejects an unknown field", async () => {
    expect(await resumePlaybook.run({ field: "wizardry" }, toolContext())).toMatchObject({ error: expect.any(String) });
  });
});
