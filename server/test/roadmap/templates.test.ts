import { describe, expect, it } from "vitest";
import { detectField, templateUnit } from "../../src/roadmap/templates";
import { STEP_KINDS } from "../../src/roadmap/types";

describe("detectField", () => {
  it.each([
    ["Junior software developer", "tech"],
    ["Data analyst", "tech"],
    ["Marketing coordinator", "business"],
    ["Graphic designer", "creative"],
    ["Registered nurse", "health"],
    ["Electrician apprentice", "general"],
  ])("puts %s under %s", (goal, field) => {
    expect(detectField(goal)).toBe(field);
  });
});

describe("templateUnit", () => {
  it("never runs out: any index gives a unit of steps with every field filled", () => {
    for (const goal of ["Software developer", "Accountant", "Illustrator", "Nurse", "Chef"]) {
      for (const index of [0, 1, 2, 7, 40]) {
        const unit = templateUnit(goal, index);
        expect(unit.source).toBe("template");
        expect(unit.steps.length).toBeGreaterThanOrEqual(3);
        for (const step of unit.steps) {
          expect(STEP_KINDS).toContain(step.kind);
          expect(step.title && step.why && step.estimate).toBeTruthy();
          expect(step.id).toMatch(/^st_/);
        }
      }
    }
  });

  it("ties each reason to the goal and is the same for the same goal and index", () => {
    const a = templateUnit("Registered nurse", 0);
    const b = templateUnit("Registered nurse", 0);
    expect(a.steps.some((s) => s.why.includes("Registered nurse"))).toBe(true);
    expect(a.steps.map(({ id: _, ...rest }) => rest)).toEqual(b.steps.map(({ id: _, ...rest }) => rest));
  });
});
