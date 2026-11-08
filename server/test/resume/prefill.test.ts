import { describe, expect, it } from "vitest";
import { emptyProfile } from "../../src/memory/profile/patch";
import type { Profile } from "../../src/memory/profile/types";
import { locationFromProfile, prefillResume } from "../../src/resume/prefill";
import { emptyResume } from "../../src/resume/types";
import { sampleResume } from "./fixtures";

const profile: Profile = {
  ...emptyProfile(),
  headline: "Third-year computer science student",
  goals: ["Search so far: Applying, but no callbacks", "Looking in: Calgary"],
  skills: [{ name: "Python", source: "resume" }],
  education: [{ school: "University of Calgary", program: "BSc Computer Science", expectedGraduation: "2028" }],
  experience: [{ role: "Developer Co-op", org: "ATB Financial", start: "May 2026", highlights: ["Built a Flask API"] }],
  projects: [{ name: "Budget tracker", summary: "A SwiftUI budgeting app" }],
};
const account = { name: "Kostia Ilnytskyi", email: "kostia@example.com", phone: "+1 403 555 0100" };

describe("prefillResume", () => {
  it("fills a blank resume from the account and the profile", () => {
    const resume = prefillResume(emptyResume(), profile, account);
    expect(resume.contact).toEqual({ ...account, location: "Calgary", links: [] });
    expect(resume.summary).toBe("Third-year computer science student");
    expect(resume.education).toEqual([{ school: "University of Calgary", program: "BSc Computer Science", year: "2028" }]);
    expect(resume.experience[0]).toMatchObject({ role: "Developer Co-op", org: "ATB Financial", bullets: ["Built a Flask API"] });
    expect(resume.projects).toEqual([{ name: "Budget tracker", bullets: ["A SwiftUI budgeting app"], link: "" }]);
    expect(resume.skills).toEqual(["Python"]);
  });

  it("never overwrites what the person typed", () => {
    const typed = { ...sampleResume, contact: { ...sampleResume.contact, location: "Edmonton" } };
    expect(prefillResume(typed, profile, account)).toEqual(typed);
  });

  it("fills only the blanks of a saved resume", () => {
    const saved = { ...sampleResume, contact: { ...sampleResume.contact, name: "", email: "", location: "" }, skills: [] };
    const resume = prefillResume(saved, profile, account);
    expect(resume.contact).toMatchObject({ name: account.name, email: account.email, phone: sampleResume.contact.phone, location: "Calgary" });
    expect(resume.experience).toEqual(sampleResume.experience);
    expect(resume.skills).toEqual(["Python"]);
  });

  it("works without an account, as for a headset token", () => {
    expect(prefillResume(emptyResume(), profile, undefined).contact).toEqual({ name: "", email: "", phone: "", location: "Calgary", links: [] });
  });
});

describe("locationFromProfile", () => {
  const withWhere = (where: string) => ({ ...emptyProfile(), goals: [`Looking in: ${where}`] });

  it("reads a city from the onboarding answer, and a country from 'Anywhere in'", () => {
    expect(locationFromProfile(withWhere("Calgary"))).toBe("Calgary");
    expect(locationFromProfile(withWhere("Anywhere in Canada"))).toBe("Canada");
  });

  it("leaves remote out: it is a preference, not where the person is", () => {
    expect(locationFromProfile(withWhere("Remote"))).toBe("");
    expect(locationFromProfile(emptyProfile())).toBe("");
  });
});
