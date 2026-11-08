import { describe, expect, it } from "vitest";
import type { Requirement } from "../../src/recommend/types";
import { bannedPhrasesIn, containsQuote, verifyRequirements, withoutBannedPhrases } from "../../src/recommend/verify";

const posting = "Junior Analyst.\nWe need:   Excel,\ncommunication skills.";
const profile = "Built budget models in Excel at the Students' Union.";

describe("containsQuote", () => {
  it("ignores case and whitespace differences", () => {
    expect(containsQuote(posting, "we need: excel, communication")).toBe(true);
    expect(containsQuote(posting, "SQL")).toBe(false);
  });

  it("never matches an empty or trivially short quote", () => {
    expect(containsQuote(posting, "  ")).toBe(false);
    expect(containsQuote(posting, "e")).toBe(false);
  });
});

describe("verifyRequirements", () => {
  it("case 6: drops a requirement the posting does not contain", () => {
    const draft: Requirement[] = [
      { quote: "Excel", kind: "required", met: "yes", evidence: "Built budget models in Excel" },
      { quote: "communication skills", kind: "required", met: "unknown" },
      { quote: "requires SQL", kind: "required", met: "no" },
    ];
    const { requirements, dropped } = verifyRequirements(draft, { source: posting, profile });
    expect(requirements.map((r) => r.quote)).toEqual(["Excel", "communication skills"]);
    expect(dropped).toEqual(["requires SQL"]);
    expect(JSON.stringify(requirements)).not.toContain("SQL");
  });

  it("drops evidence the profile does not contain, so the claim becomes unknown", () => {
    const draft: Requirement[] = [{ quote: "Excel", kind: "required", met: "yes", evidence: "Expert in Excel macros" }];
    const { requirements } = verifyRequirements(draft, { source: posting, profile });
    expect(requirements).toEqual([{ quote: "Excel", kind: "required", met: "unknown" }]);
  });

  it("does not accept met without evidence", () => {
    const { requirements } = verifyRequirements([{ quote: "Excel", kind: "required", met: "yes" }], { source: posting, profile });
    expect(requirements[0].met).toBe("unknown");
  });
});

describe("banned phrases", () => {
  it("finds overconfident phrases and invented fit percentages", () => {
    expect(bannedPhrasesIn("You are a perfect fit. Definitely apply, 87% match.")).toEqual(["perfect fit", "definitely", "87% match"]);
    expect(bannedPhrasesIn("Meeting the requirements doesn't guarantee an interview.")).toEqual([]);
  });

  it("removes every sentence that uses one", () => {
    expect(withoutBannedPhrases("Apply by Friday. You're guaranteed an interview! Mention your co-op.")).toBe("Apply by Friday. Mention your co-op.");
  });
});
