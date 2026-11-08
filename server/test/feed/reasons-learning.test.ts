import { describe, expect, it } from "vitest";
import { criteriaFrom } from "../../src/feed/criteria";
import { curatedCandidates } from "../../src/feed/curation";
import { jobCandidate } from "../../src/feed/jobs";
import { rankCandidates } from "../../src/feed/rank";
import type { Candidate, FeedField } from "../../src/feed/types";
import type { JobPosting } from "../../src/integrations/adzuna";
import type { Profile } from "../../src/memory/profile/types";

const NOW = new Date("2026-11-07T12:00:00Z");

const profile = (extra: Partial<Profile> = {}): Profile => ({ targetRoles: [], goals: [], skills: [], education: [], experience: [], projects: [], certifications: [], ...extra });
const analyst = profile({ targetRoles: ["Junior data analyst"], skills: [{ name: "Excel", source: "resume" }] });

const job = (id: string, title: string, description: string) =>
  jobCandidate({ title, company: "ATB", location: "Calgary, AB", posted_at: "2026-11-05T00:00:00Z", description, url: `https://www.adzuna.ca/details/${id}` } as JobPosting);

const course = (id: string, tags: string[], fields: FeedField[] = ["cs"]): Candidate => ({
  card: { id, kind: "course", title: `Course ${id}`, org: "Org", url: `https://example.org/${id}`, source: "Curated", tags },
  text: tags.join(", "),
  fields,
});

const cardFor = (id: string, candidates: Candidate[], person = analyst) => rankCandidates(candidates, criteriaFrom(person), NOW).find((c) => c.id === id)!;
const cs50x = () => curatedCandidates(NOW).find((c) => c.card.id === "course:cs50x")!;

describe("why a course fits", () => {
  it("names a skill the course teaches that postings for the person's target role ask for", () => {
    const card = cardFor("course:cs50x", [cs50x(), job("1", "Data Analyst", "Clean data with Python and build reports")]);
    expect(card.reasons).toContain("Teaches Python, which Junior data analyst jobs ask for");
    expect(card.why).toBe(card.reasons[0]);
  });

  it("never claims a role asks for something no posting mentions, and ignores one-letter tags", () => {
    const card = cardFor("course:cs50x", [cs50x(), job("1", "Data Analyst", "Excel reporting in a C-suite facing team")]);
    expect(card.reasons.some((r) => r.startsWith("Teaches"))).toBe(false);
  });

  it("ties the course to the goal by field when there are no postings to point at", () => {
    const card = cardFor("c", [course("c", ["sql", "tableau"])]);
    expect(card.reasons).toContain("Covers SQL for your Junior data analyst goal");
  });

  it("says a course builds on skills the person already has", () => {
    const person = profile({ targetRoles: ["Junior developer"], skills: [{ name: "JavaScript", source: "resume" }] });
    expect(cardFor("c", [course("c", ["javascript", "algorithms"])], person).reasons).toContain("Builds on your JavaScript");
  });

  it("gives every curated course at least one reason for a data analyst, three at most", () => {
    const ranked = rankCandidates(curatedCandidates(NOW), criteriaFrom(analyst), NOW).filter((c) => c.kind === "course");
    expect(ranked.length).toBeGreaterThan(0);
    for (const card of ranked) {
      expect(card.reasons.length).toBeGreaterThanOrEqual(1);
      expect(card.reasons.length).toBeLessThanOrEqual(3);
    }
  });
});

describe("why a job fits", () => {
  it("counts a posting as fitting the goal when only a seniority word is missing from its title", () => {
    expect(cardFor("job:1", [job("1", "Data Analyst", "Reporting")]).reasons[0]).toBe("Fits your goal: Junior data analyst");
  });
});
