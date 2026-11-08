import { describe, expect, it } from "vitest";
import { detectField, personFor, templateSteps } from "../../src/roadmap/templates";
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

describe("templateSteps", () => {
  it("never runs out: any position gives a full step, and the same person gets the same steps", () => {
    for (const goal of ["Software developer", "Accountant", "Illustrator", "Nurse", "Chef"]) {
      const person = personFor(goal, []);
      const steps = templateSteps(person, 0, 40);
      expect(steps).toHaveLength(40);
      for (const step of steps) {
        expect(STEP_KINDS).toContain(step.kind);
        expect(step.title && step.why && step.detail && step.estimate && step.label).toBeTruthy();
      }
      expect(templateSteps(person, 5, 3)).toEqual(steps.slice(5, 8));
    }
  });

  it("leans on the person's own skill and goal", () => {
    const steps = templateSteps(personFor("Junior data analyst", ["SQL", "Python"]), 0, 8);
    expect(steps[0].title).toContain("SQL");
    expect(steps.some((s) => s.why.includes("Junior data analyst") || s.title.includes("Junior data analyst"))).toBe(true);
  });

  it("gives practice steps an action the app can launch", () => {
    const steps = templateSteps(personFor("Registered nurse", []), 0, 8);
    const interview = steps.find((s) => s.kind === "interview_practice");
    const networking = steps.find((s) => s.kind === "networking_practice");
    expect(interview?.action).toEqual({ type: "interview", role: "Registered nurse" });
    expect(networking?.action).toEqual({ type: "networking", role: "Registered nurse" });
    expect(steps.find((s) => s.kind === "event")?.action).toBeUndefined();
  });

  it("labels from what the person already has", () => {
    const without = templateSteps(personFor("Software developer", []), 0, 8);
    const withSkills = templateSteps(personFor("Software developer", ["Git", "SQL"]), 0, 8);
    const course = (steps: typeof without) => steps.find((s) => s.kind === "course")!;
    expect(course(without).label).toBe("long_term");
    expect(course(withSkills).label).toBe("ready_now");
    expect(without.find((s) => s.kind === "event")?.label).toBe("ready_now");
  });
});
