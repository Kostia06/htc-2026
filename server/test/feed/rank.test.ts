import { describe, expect, it } from "vitest";
import { rankCandidates } from "../../src/feed/rank";
import type { Candidate } from "../../src/feed/types";

const NOW = new Date("2026-11-07T12:00:00Z");

function job(id: string, title: string, extra: Partial<Candidate> & { where?: string } = {}): Candidate {
  return {
    card: { id, kind: "job", title, org: "Acme", url: `https://www.adzuna.ca/details/${id}`, source: "Adzuna", where: extra.where },
    text: extra.text ?? title,
    postedAt: extra.postedAt ?? "2026-10-01T00:00:00Z",
  };
}

const criteria = { roles: ["Junior developer"], skills: ["React", "TypeScript", "SQL"], location: "Calgary" };

describe("feed ranking", () => {
  it("puts a target-role match above a skills match above neither", () => {
    const ranked = rankCandidates([job("1", "Barista"), job("2", "Data analyst", { text: "SQL and React daily" }), job("3", "Junior Developer")], criteria, NOW);
    expect(ranked.map((c) => c.id)).toEqual(["3", "2", "1"]);
  });

  it("explains each card from the profile in one short line", () => {
    const [role, skills] = rankCandidates([job("1", "Junior Software Developer"), job("2", "Analyst", { text: "React and TypeScript, some SQL" })], criteria, NOW);
    expect(role.why).toBe("Fits your goal: Junior developer");
    expect(skills.why).toBe("Uses React, TypeScript and SQL from your profile");
  });

  it("breaks ties by location, then by how recently it was posted", () => {
    const ranked = rankCandidates(
      [job("old", "Cook", { postedAt: "2026-09-01T00:00:00Z" }), job("new", "Cook", { postedAt: "2026-11-06T00:00:00Z" }), job("near", "Cook", { where: "Calgary, Alberta" })],
      criteria,
      NOW,
    );
    expect(ranked.map((c) => c.id)).toEqual(["near", "new", "old"]);
    expect(ranked[0].why).toBe("Near you in Calgary");
  });

  it("matches skills as whole words, so Java does not match JavaScript", () => {
    const [card] = rankCandidates([job("1", "Web role", { text: "JavaScript only" })], { roles: [], skills: ["Java"] }, NOW);
    expect(card.why).not.toContain("Java from");
  });

  it("drops a second listing with the same link", () => {
    expect(rankCandidates([job("1", "Junior developer"), job("1", "Junior developer")], criteria, NOW)).toHaveLength(1);
  });
});
