import { describe, expect, it } from "vitest";
import { groundChanges } from "../../src/resume/tailor/ground";
import { sampleResume } from "./fixtures";

const requirements = [
  { text: "Strong SQL skills", topic: "SQL", required: true },
  { text: "Experience building REST APIs", topic: "REST APIs", required: true },
  { text: "Tableau dashboards", topic: "Tableau", required: false },
];
const input = { resume: sampleResume, requirements, profileText: "Skills: Python, SQL, SwiftUI" };

const rewrite = (over: Record<string, unknown> = {}) => ({
  action: "rewrite",
  path: "experience[0].bullets[1]",
  before: "Wrote SQL reports in Postgres for the lending team",
  after: "Wrote SQL reports in Postgres that the lending team relied on",
  why: "Leads with SQL, which the posting asks for first.",
  requirement: 1,
  ...over,
});

describe("groundChanges", () => {
  it("keeps a rewrite of an existing bullet and points it at the base line and the requirement", () => {
    expect(groundChanges(input, [rewrite()])).toEqual([
      {
        id: "c1",
        kind: "reword",
        section: "experience",
        basedOn: "experience[0].bullets[1]",
        before: "Wrote SQL reports in Postgres for the lending team",
        after: "Wrote SQL reports in Postgres that the lending team relied on",
        why: "Leads with SQL, which the posting asks for first.",
        requirement: "Strong SQL skills",
        accepted: true,
      },
    ]);
  });

  it("drops a rewrite that adds a number, a tool or a posting skill the bullet never had", () => {
    const changes = groundChanges(input, [
      rewrite({ after: "Wrote 40 SQL reports in Postgres for the lending team" }),
      rewrite({ path: "experience[0].bullets[0]", before: "Worked on a Python Flask API", after: "Built a Python Flask API on AWS", requirement: 2 }),
      rewrite({ path: "projects[0].bullets[0]", before: "Built a budgeting app with SwiftUI", after: "Built a budgeting app with SwiftUI and tableau dashboards", requirement: 3 }),
    ]);
    expect(changes).toEqual([]);
  });

  it("drops changes to paths that don't exist, a misquoted before, an unknown requirement and no-op rewrites", () => {
    const changes = groundChanges(input, [
      rewrite({ path: "experience[3].bullets[0]" }),
      rewrite({ before: "Something else entirely" }),
      rewrite({ requirement: 9 }),
      rewrite({ after: "Wrote SQL reports in Postgres for the lending team." }),
      rewrite({ path: "contact.name", before: "Jordan Lee", after: "Jordan" }),
    ]);
    expect(changes).toEqual([]);
  });

  it("lets the summary use words from anywhere in the resume or profile, but not beyond", () => {
    const kept = groundChanges(input, [
      { action: "rewrite", path: "summary", after: "Computer science student who writes SQL and Python", why: "Names the posting's core skills.", requirement: 1 },
    ]);
    expect(kept).toHaveLength(1);
    const dropped = groundChanges(input, [
      { action: "rewrite", path: "summary", after: "Computer science student with Kubernetes experience", why: "x", requirement: 1 },
    ]);
    expect(dropped).toEqual([]);
  });

  it("trims a bullet that doesn't serve the job, but never the last one in an entry", () => {
    const resume = { ...sampleResume, projects: [{ name: "Budget tracker", bullets: ["Built a budgeting app with SwiftUI"], link: "" }] };
    const changes = groundChanges({ ...input, resume }, [
      { action: "remove", path: "experience[0].bullets[0]", why: "Less relevant to a data role." },
      { action: "remove", path: "experience[0].bullets[1]", why: "Also." },
      { action: "remove", path: "projects[0].bullets[0]", why: "Only one." },
      { action: "remove", path: "summary", why: "No." },
    ]);
    expect(changes).toEqual([
      { id: "c1", kind: "trim", section: "experience", basedOn: "experience[0].bullets[0]", before: "Worked on a Python Flask API", after: "", why: "Less relevant to a data role.", requirement: null, accepted: true },
    ]);
  });

  it("ignores anything that isn't a list of changes", () => {
    expect(groundChanges(input, "nope")).toEqual([]);
    expect(groundChanges(input, [null, 3, { path: 1 }])).toEqual([]);
  });
});
