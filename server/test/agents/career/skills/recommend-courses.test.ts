import { describe, expect, it } from "vitest";
import { recommendCourses } from "../../../../src/agents/career/skills/recommend-courses";
import { fetched, profileCall } from "../../../recommend/tool-calls";

const CPSC_331 = "https://calendar.ucalgary.ca/courses/1071981";
const page = fetched(
  CPSC_331,
  "Computer Science 331 Data Structures, Algorithms, and Their Analysis. Prerequisite(s): 3 units from Computer Science 251, Mathematics 271 or 273; and 3 units from Computer Science 219, 233 or 235. Antirequisite(s): Credit for Computer Science 331 and 319 will not be allowed.",
);

const cpsc331 = {
  title: "CPSC 331",
  source_url: CPSC_331,
  requirements: [
    { quote: "3 units from Computer Science 219, 233 or 235", kind: "required", met: "yes", evidence: "CPSC 233" },
    { quote: "3 units from Computer Science 251, Mathematics 271 or 273", kind: "required", met: "no" },
  ],
  antirequisites: [{ quote: "Credit for Computer Science 331 and 319 will not be allowed", evidence: "CPSC 319" }],
  next_step: "Take MATH 271 next term, then CPSC 331.",
  path: "MATH 271, then CPSC 331.",
};

type Output = { items: { level: string; next_step: string }[]; not_a_fit: { title: string; reason: string }[] };
const finalize = (transcript: string) => recommendCourses.finalize!({ items: [cpsc331] }, [profileCall({ transcript }), page]) as Output;

describe("recommend-courses skill", () => {
  it("runs on the app only", () => {
    expect(recommendCourses.platforms).toEqual(["app"]);
  });

  it("case 7: one missing prerequisite group is a stretch, with the course to take first", () => {
    const { items, not_a_fit } = finalize("Completed: CPSC 231, CPSC 233.");
    expect(items).toHaveLength(1);
    expect(items[0].level).toBe("stretch");
    expect(items[0].next_step).toContain("MATH 271");
    expect(not_a_fit).toEqual([]);
  });

  it("case 7: an antirequisite already taken is not a fit", () => {
    const { items, not_a_fit } = finalize("Completed: CPSC 231, CPSC 233, CPSC 319.");
    expect(items).toEqual([]);
    expect(not_a_fit[0]).toMatchObject({ title: "CPSC 331", reason: expect.stringContaining("antirequisite") });
  });

  it("can't tell when there is no transcript", () => {
    const { items } = finalize("");
    expect(items[0].level).toBe("cant_tell");
  });
});
