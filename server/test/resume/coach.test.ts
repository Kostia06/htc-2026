import { describe, expect, it } from "vitest";
import { ADD_NUMBER, editablePaths, readPath, verifySuggestions, withoutInventedNumbers } from "../../src/resume/coach";
import { sampleResume } from "./fixtures";

describe("resume paths", () => {
  it("reads the strings a path points at and nothing else", () => {
    expect(readPath(sampleResume, "summary")).toBe("Third-year computer science student");
    expect(readPath(sampleResume, "experience[0].bullets[1]")).toBe("Wrote SQL reports in Postgres for the lending team");
    expect(readPath(sampleResume, "experience[0]")).toBeUndefined();
    expect(readPath(sampleResume, "experience[9].bullets[0]")).toBeUndefined();
    expect(readPath(sampleResume, "contact.email")).toBe("jordan@example.com");
  });

  it("lists every editable line, or one section of them", () => {
    expect(editablePaths(sampleResume).map((p) => p.path)).toEqual(["summary", "experience[0].bullets[0]", "experience[0].bullets[1]", "projects[0].bullets[0]"]);
    expect(editablePaths(sampleResume, "projects").map((p) => p.path)).toEqual(["projects[0].bullets[0]"]);
  });
});

describe("withoutInventedNumbers", () => {
  it("keeps numbers the original had and replaces new ones", () => {
    expect(withoutInventedNumbers("Served 2,000 users", "Scaled an API to 2,000 users, cutting latency 40%")).toBe(
      `Scaled an API to 2,000 users, cutting latency ${ADD_NUMBER}`,
    );
    expect(withoutInventedNumbers("Wrote reports", "Saved the team $5k a month")).toBe(`Saved the team ${ADD_NUMBER} a month`);
  });
});

describe("verifySuggestions", () => {
  it("keeps a rewrite of a real line and fills in the true before", () => {
    const kept = verifySuggestions(sampleResume, [
      { path: "experience[0].bullets[0]", before: "Worked on a  Python Flask API", after: "Built a Python Flask API used by [add number] internal users", why: "Shows the outcome." },
    ]);
    expect(kept).toEqual([
      { path: "experience[0].bullets[0]", before: "Worked on a Python Flask API", after: "Built a Python Flask API used by [add number] internal users", why: "Shows the outcome." },
    ]);
  });

  it("drops unknown paths, stale befores, unchanged lines, duplicates and non-objects", () => {
    const kept = verifySuggestions(sampleResume, [
      { path: "experience[3].bullets[0]", before: "x", after: "y", why: "" },
      { path: "summary", before: "Something else entirely", after: "Rewritten", why: "" },
      { path: "projects[0].bullets[0]", before: "Built a budgeting app with SwiftUI", after: "Built a budgeting app with SwiftUI.", why: "" },
      { path: "experience[0].bullets[1]", after: "Delivered SQL reports in Postgres for the lending team", why: "" },
      { path: "experience[0].bullets[1]", after: "Another rewrite", why: "" },
      "junk",
    ]);
    expect(kept.map((s) => s.path)).toEqual(["experience[0].bullets[1]"]);
    expect(verifySuggestions(sampleResume, "not a list")).toEqual([]);
  });

  it("replaces invented numbers and drops a rewrite that makes a confidence claim", () => {
    const kept = verifySuggestions(sampleResume, [
      { path: "summary", after: "Third-year computer science student with 3 shipped projects", why: "" },
      { path: "experience[0].bullets[0]", after: "Worked on a Python Flask API, a perfect fit for data roles", why: "" },
    ]);
    expect(kept.map((s) => s.after)).toEqual([`Third-year computer science student with ${ADD_NUMBER} shipped projects`]);
  });
});
