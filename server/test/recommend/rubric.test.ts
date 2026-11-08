import { describe, expect, it } from "vitest";
import { assessFit, experienceGap, type FitInput } from "../../src/recommend/rubric";
import type { Requirement } from "../../src/recommend/types";

const met = (quote: string, kind: Requirement["kind"] = "required"): Requirement => ({ quote, kind, met: "yes", evidence: `has ${quote}` });
const missing = (quote: string, kind: Requirement["kind"] = "required"): Requirement => ({ quote, kind, met: "no" });
const unknown = (quote: string, kind: Requirement["kind"] = "required"): Requirement => ({ quote, kind, met: "unknown" });

const fit = (over: Partial<FitInput>): FitInput => ({
  requirements: [],
  experienceGapYears: 0,
  jobZone: { role: 3, person: 3 },
  separatesRequired: true,
  ...over,
});

describe("experienceGap", () => {
  it("counts work in full and each project as half a year", () => {
    expect(experienceGap(2, { workYears: 0.5, projects: 2 })).toBe(0.5);
    expect(experienceGap(0, { workYears: 1, projects: 0 })).toBe(0);
  });
});

describe("assessFit", () => {
  it("case 1: co-op dev role with every required item met is ready now, preferred AWS still missing", () => {
    const result = assessFit(
      fit({ requirements: [met("currently enrolled in CS or related", "hard"), met("Python"), met("SQL"), missing("AWS", "preferred")] }),
    );
    expect(result.level).toBe("ready_now");
    expect(result.counts.summary).toBe("3 of 3 required");
    expect(result.missing).toEqual([{ requirement: "AWS", kind: "preferred" }]);
  });

  it("case 2: one learnable must-have missing is a stretch", () => {
    const result = assessFit(fit({ requirements: [met("Python"), met("SQL"), missing("React")] }));
    expect(result.level).toBe("stretch");
    expect(result.counts.summary).toBe("2 of 3 required");
    expect(result.missing.map((m) => m.requirement)).toEqual(["React"]);
  });

  it("case 3: five years short is long term", () => {
    const result = assessFit(fit({ requirements: [met("SQL")], experienceGapYears: 5, jobZone: { role: 4, person: 3 } }));
    expect(result.level).toBe("long_term");
    expect(result.reasons.join(" ")).toContain("5 years");
  });

  it("case 4: a PhD role two job zones up is long term", () => {
    const result = assessFit(
      fit({ requirements: [missing("PhD in ML required", "hard"), met("machine learning")], jobZone: { role: 5, person: 3 } }),
    );
    expect(result.level).toBe("long_term");
  });

  it("case 5: an unknown hard gate means can't tell", () => {
    const result = assessFit(
      fit({ requirements: [unknown("cumulative GPA of at least 2.0", "hard"), unknown("continuing in the following fall", "hard")] }),
    );
    expect(result.level).toBe("cant_tell");
    expect(result.unknown.map((u) => u.requirement)).toEqual(["cumulative GPA of at least 2.0", "continuing in the following fall"]);
  });

  it("case 7: one missing prerequisite group is a stretch", () => {
    const result = assessFit(
      fit({ requirements: [met("3 units from Computer Science 219, 233 or 235"), missing("3 units from Computer Science 251, Mathematics 271 or 273")] }),
    );
    expect(result.level).toBe("stretch");
  });

  it("case 9: an unseparated posting the person fully meets is capped at stretch, with the reason", () => {
    const result = assessFit(fit({ requirements: [met("Excel"), met("communication")], separatesRequired: false }));
    expect(result.level).toBe("stretch");
    expect(result.reasons.join(" ")).toContain("doesn't say which items are required");
  });

  it("treats items labelled preferred as must-haves when the posting has no split", () => {
    const result = assessFit(fit({ requirements: [met("Excel"), missing("SQL", "preferred")], separatesRequired: false }));
    expect(result.counts.summary).toBe("1 of 2 required");
  });

  it("more than 30% of must-haves unknown means can't tell", () => {
    const result = assessFit(fit({ requirements: [met("Python"), unknown("Go"), unknown("Rust")] }));
    expect(result.level).toBe("cant_tell");
  });

  it("an unmet hard gate is long term even when everything else is met", () => {
    const result = assessFit(fit({ requirements: [missing("valid Alberta driver's licence", "hard"), met("Python"), met("SQL")] }));
    expect(result.level).toBe("long_term");
  });

  it("does not ask when the answer could not lift it above long term", () => {
    const result = assessFit(fit({ requirements: [unknown("GPA of 3.0", "hard")], experienceGapYears: 3 }));
    expect(result.level).toBe("long_term");
  });

  it("three missing must-haves is long term", () => {
    const result = assessFit(fit({ requirements: [met("Python"), met("SQL"), met("Git"), missing("React"), missing("AWS"), missing("Docker")] }));
    expect(result.level).toBe("long_term");
  });

  it("a one-year gap is at best a stretch", () => {
    const result = assessFit(fit({ requirements: [met("Python")], experienceGapYears: 1 }));
    expect(result.level).toBe("stretch");
  });

  it("can't tell when no requirement survived verification, rather than calling it ready", () => {
    expect(assessFit(fit({ requirements: [] })).level).toBe("cant_tell");
  });
});
