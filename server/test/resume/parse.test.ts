import { describe, expect, it } from "vitest";
import { emptyProfile } from "../../src/memory/profile/patch";
import { parseResume, seedFromProfile } from "../../src/resume/parse";
import { sampleResume } from "./fixtures";

describe("parseResume", () => {
  it("keeps a well-formed resume as it is", () => {
    expect(parseResume(sampleResume)).toEqual(sampleResume);
  });

  it("rejects anything that is not an object", () => {
    expect(parseResume(["nope"])).toBeNull();
    expect(parseResume("text")).toBeNull();
    expect(parseResume(null)).toBeNull();
  });

  it("fills missing fields, trims text and drops malformed entries", () => {
    const parsed = parseResume({
      summary: "  Student  ",
      experience: [{ role: "Dev", bullets: ["a", 3, "  ", "b"] }, "junk", { start: "2020" }],
      education: [{ program: "no school" }, { school: "UCalgary" }],
      projects: [{ name: "App", bullets: "not a list" }],
      skills: ["Python", "", 7],
      extra: "ignored",
    });
    expect(parsed).toEqual({
      contact: { name: "", email: "", phone: "", links: [] },
      summary: "Student",
      experience: [{ role: "Dev", org: "", start: "", end: "", bullets: ["a", "b"] }],
      education: [{ school: "UCalgary", program: "", year: "" }],
      projects: [{ name: "App", bullets: [], link: "" }],
      skills: ["Python"],
    });
  });

  it("caps list lengths", () => {
    const parsed = parseResume({ skills: Array.from({ length: 60 }, (_, i) => `skill ${i}`) });
    expect(parsed?.skills).toHaveLength(40);
  });
});

describe("seedFromProfile", () => {
  it("lays the profile out as a resume, with highlights as bullets and skill names only", () => {
    const seeded = seedFromProfile({
      ...emptyProfile(),
      headline: "Third-year computer science student",
      skills: [{ name: "Python", source: "resume", evidence: "Built a Python Flask API" }],
      education: [{ school: "University of Calgary", program: "BSc", expectedGraduation: "April 2028" }],
      experience: [{ role: "Co-op", org: "ATB", start: "May 2026", highlights: ["Built an API"] }],
      projects: [{ name: "Tracker", summary: "A budgeting app" }],
    });
    expect(seeded).toMatchObject({
      summary: "Third-year computer science student",
      skills: ["Python"],
      education: [{ school: "University of Calgary", program: "BSc", year: "April 2028" }],
      experience: [{ role: "Co-op", org: "ATB", start: "May 2026", end: "", bullets: ["Built an API"] }],
      projects: [{ name: "Tracker", bullets: ["A budgeting app"], link: "" }],
    });
    expect(seeded.contact).toEqual({ name: "", email: "", phone: "", links: [] });
  });
});
