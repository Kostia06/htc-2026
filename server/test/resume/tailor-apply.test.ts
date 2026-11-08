import { describe, expect, it } from "vitest";
import { applyChanges, matchSummary, skillsChange } from "../../src/resume/tailor/apply";
import type { TailorChange } from "../../src/resume/tailor/types";
import { sampleResume } from "./fixtures";

const requirements = [
  { text: "Strong SQL skills", topic: "SQL", required: true, have: true },
  { text: "Tableau dashboards", topic: "Tableau", required: true, have: true, evidence: "Skill: Tableau" },
  { text: "Kubernetes", topic: "Kubernetes", required: false, have: false },
];

const reword: TailorChange = {
  id: "c1", kind: "reword", section: "experience", basedOn: "experience[0].bullets[1]",
  before: "Wrote SQL reports in Postgres for the lending team", after: "Wrote SQL reports in Postgres that the lending team used", why: "w", requirement: "Strong SQL skills", accepted: true,
};
const trim: TailorChange = {
  id: "c2", kind: "trim", section: "experience", basedOn: "experience[0].bullets[0]", before: "Worked on a Python Flask API", after: "", why: "w", requirement: null, accepted: true,
};

describe("skillsChange", () => {
  it("moves the skills the posting asks for to the front and adds ones only the profile lists", () => {
    const change = skillsChange(sampleResume, requirements, ["Python", "Tableau", "Excel"], "c3");
    expect(change).toMatchObject({
      id: "c3", kind: "reorder", section: "skills", basedOn: "skills", before: "Python, SQL, SwiftUI", after: "SQL, Tableau, Python, SwiftUI",
      requirement: "Strong SQL skills", accepted: true, skills: ["SQL", "Tableau", "Python", "SwiftUI"],
    });
    expect(change?.why).toContain("Tableau");
  });

  it("is null when the order already fits", () => {
    expect(skillsChange({ ...sampleResume, skills: ["SQL", "Python"] }, requirements.slice(0, 1), [], "c1")).toBeNull();
  });
});

describe("applyChanges", () => {
  it("applies accepted changes to a copy of the base and skips reverted ones", () => {
    const skills = skillsChange(sampleResume, requirements, ["Tableau"], "c3")!;
    const tailored = applyChanges(sampleResume, [reword, trim, skills]);
    expect(tailored.experience[0].bullets).toEqual(["Wrote SQL reports in Postgres that the lending team used"]);
    expect(tailored.skills).toEqual(["SQL", "Tableau", "Python", "SwiftUI"]);
    expect(tailored.experience[0].org).toBe("ATB Financial");
    expect(sampleResume.experience[0].bullets).toHaveLength(2);

    const reverted = applyChanges(sampleResume, [{ ...reword, accepted: false }, { ...trim, accepted: false }]);
    expect(reverted.experience[0].bullets).toEqual(sampleResume.experience[0].bullets);
  });
});

describe("matchSummary", () => {
  it("counts a requirement as covered when the resume shows it", () => {
    const skills = skillsChange(sampleResume, requirements, ["Tableau"], "c3")!;
    const match = matchSummary(sampleResume, applyChanges(sampleResume, [skills]), requirements);
    expect(match.covered.map((r) => r.topic)).toEqual(["SQL", "Tableau"]);
    expect(match.missing.map((r) => r.topic)).toEqual(["Kubernetes"]);
    expect(match.coveredBefore).toBe(1);
  });
});
