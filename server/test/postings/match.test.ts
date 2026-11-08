import { describe, expect, it } from "vitest";
import { emptyProfile } from "../../src/memory/profile/patch";
import { haveCount, markRequirements, missingRequirements } from "../../src/postings/match";
import { slugify } from "../../src/postings/prefill";

const profile = {
  ...emptyProfile(),
  skills: [{ name: "SQL", source: "resume" as const }, { name: "Go", source: "self-reported" as const }],
  experience: [{ role: "Co-op developer", org: "ATB", highlights: ["Built a Flask API used by 2,000 staff"] }],
};

describe("markRequirements", () => {
  it("trusts a quote only when it really is in the profile", () => {
    const [proven, invented] = markRequirements(
      [
        { text: "REST API experience", topic: "REST APIs", required: true, evidence: "Built a Flask API used by 2,000 staff" },
        { text: "Kubernetes", topic: "Kubernetes", required: true, evidence: "Ran Kubernetes clusters" },
      ],
      profile,
    );
    expect(proven).toMatchObject({ have: true, evidence: "Built a Flask API used by 2,000 staff" });
    expect(invented).toEqual({ text: "Kubernetes", topic: "Kubernetes", required: true, have: false });
  });

  it("counts a skill the person listed by name, whole words only", () => {
    const [sql, go, good] = markRequirements(
      [
        { text: "Strong SQL skills", topic: "SQL", required: true },
        { text: "Services written in Go", topic: "Go", required: false },
        { text: "Good communication", topic: "communication", required: true },
      ],
      profile,
    );
    expect(sql).toMatchObject({ have: true, evidence: "Skill: SQL" });
    expect(go).toMatchObject({ have: true, evidence: "Skill: Go" });
    expect(good).toMatchObject({ have: false });
  });

  it("puts the required gaps before the nice-to-haves", () => {
    const marked = markRequirements(
      [
        { text: "dbt", topic: "dbt", required: false },
        { text: "SQL", topic: "SQL", required: true },
        { text: "Python", topic: "Python", required: true },
      ],
      profile,
    );
    expect(missingRequirements(marked).map((r) => r.text)).toEqual(["Python", "dbt"]);
    expect(haveCount(marked)).toBe(1);
  });
});

describe("slugify", () => {
  it("makes the same slug Skillit's companies use", () => {
    expect(slugify("Acme Analytics")).toBe("acme-analytics");
    expect(slugify("  ATB Financial, Inc. ")).toBe("atb-financial-inc");
    expect(slugify("Société Générale")).toBe("societe-generale");
    expect(slugify("!!!")).toBe("");
  });
});
