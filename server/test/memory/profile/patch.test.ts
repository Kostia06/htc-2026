import { describe, expect, it } from "vitest";
import { applyPatch, emptyProfile, parsePatch } from "../../../src/memory/profile/patch";

describe("parsePatch", () => {
  it("keeps known fields and trims text", () => {
    const patch = parsePatch({ headline: "  CS student  ", skills: [{ name: " Python ", source: "resume", evidence: "Built a Flask API" }], junk: 1 });
    expect(patch).toEqual({ headline: "CS student", skills: [{ name: "Python", source: "resume", evidence: "Built a Flask API" }] });
  });

  it("rejects anything that is not an object", () => {
    expect(parsePatch("hi")).toBeNull();
    expect(parsePatch([1])).toBeNull();
  });

  it("drops skills without a name or with an unknown source", () => {
    const patch = parsePatch({ skills: [{ name: "", source: "resume" }, { name: "SQL", source: "guess" }, { name: "Go", source: "self-reported" }] });
    expect(patch?.skills).toEqual([{ name: "Go", source: "self-reported" }]);
  });
});

describe("applyPatch", () => {
  it("merges skills by name instead of duplicating them", () => {
    const first = applyPatch(emptyProfile(), { skills: [{ name: "python", source: "self-reported" }] });
    const second = applyPatch(first, { skills: [{ name: "Python", source: "resume", evidence: "Flask API" }] });
    expect(second.skills).toEqual([{ name: "Python", source: "resume", evidence: "Flask API" }]);
  });

  it("never lets a weaker source overwrite stronger evidence", () => {
    const fromResume = applyPatch(emptyProfile(), { skills: [{ name: "SQL", source: "resume", evidence: "Postgres reports" }] });
    const after = applyPatch(fromResume, { skills: [{ name: "SQL", source: "self-reported" }] });
    expect(after.skills[0]).toEqual({ name: "SQL", source: "resume", evidence: "Postgres reports" });
  });

  it("adds goals and target roles once each", () => {
    const profile = applyPatch(emptyProfile(), { goals: ["Get a co-op", "get a co-op"], targetRoles: ["Junior developer"] });
    expect(profile.goals).toEqual(["Get a co-op"]);
    expect(profile.targetRoles).toEqual(["Junior developer"]);
  });

  it("strips contact details from everything it stores", () => {
    const profile = applyPatch(emptyProfile(), { headline: "Reach me at sam@example.com or 403-555-0199" });
    expect(profile.headline).not.toContain("sam@example.com");
    expect(profile.headline).not.toContain("555-0199");
  });

  it("caps list sizes so one bad run cannot bloat the profile", () => {
    const skills = Array.from({ length: 80 }, (_, i) => ({ name: `skill ${i}`, source: "self-reported" as const }));
    expect(applyPatch(emptyProfile(), { skills }).skills).toHaveLength(50);
  });
});

describe("applyPatch with removals", () => {
  const seeded = () =>
    applyPatch(emptyProfile(), {
      targetRoles: ["Data analyst", "Developer"],
      skills: [{ name: "Python", source: "resume" }, { name: "SQL", source: "self-reported" }],
      experience: [{ role: "Co-op", org: "ATB", start: "May 2026" }],
      education: [{ school: "UCalgary", program: "BSc CS" }],
    });

  it("removes chips by name, ignoring case", () => {
    const after = applyPatch(seeded(), { remove: { targetRoles: ["data ANALYST"], skills: ["sql"] } });
    expect(after.targetRoles).toEqual(["Developer"]);
    expect(after.skills.map((s) => s.name)).toEqual(["Python"]);
  });

  it("removes experience and education by identity, then adds the edited row", () => {
    const after = applyPatch(seeded(), {
      remove: { experience: [{ role: "Co-op", org: "ATB", start: "May 2026" }], education: [{ school: "UCalgary", program: "BSc CS" }] },
      experience: [{ role: "Developer Co-op", org: "ATB", start: "May 2026" }],
    });
    expect(after.experience).toEqual([{ role: "Developer Co-op", org: "ATB", start: "May 2026" }]);
    expect(after.education).toEqual([]);
  });

  it("keeps a removal-only patch and drops an empty one", () => {
    expect(parsePatch({ remove: { skills: ["Python"] }, junk: true })).toEqual({ remove: { skills: ["Python"] } });
    expect(parsePatch({ remove: { nothing: [] } })).toEqual({});
  });
});
