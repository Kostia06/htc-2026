import { describe, expect, it } from "vitest";
import { FIELD_LABELS, fieldsOf } from "../../src/feed/fields";
import type { Profile } from "../../src/memory/profile/types";

const profile = (patch: Partial<Profile>): Profile => ({
  targetRoles: [],
  goals: [],
  skills: [],
  education: [],
  experience: [],
  projects: [],
  certifications: [],
  ...patch,
});

describe("fields of study and work", () => {
  it("reads the field from the program of study", () => {
    expect(fieldsOf(profile({ education: [{ school: "University of Calgary", program: "BSc Computer Science" }] }))).toEqual(["cs"]);
  });

  it("reads several fields from target roles and the headline", () => {
    const fields = fieldsOf(profile({ headline: "Nursing student at Bow Valley College", targetRoles: ["UX designer"] }));
    expect(fields).toEqual(["design", "health"]);
  });

  it("falls back to general when nothing in the profile names a field", () => {
    expect(fieldsOf(profile({ targetRoles: ["Barista"] }))).toEqual(["general"]);
    expect(fieldsOf(profile({}))).toEqual(["general"]);
  });

  it("names every field in words that fit the why line", () => {
    expect(FIELD_LABELS.cs).toBe("computer science");
    expect(FIELD_LABELS.business).toBe("business");
    expect(FIELD_LABELS.design).toBe("design");
    expect(FIELD_LABELS.health).toBe("health");
  });
});
