import { describe, expect, it } from "vitest";
import { criteriaFrom } from "../../src/feed/criteria";
import { rankCandidates } from "../../src/feed/rank";
import type { Candidate, FeedCriteria, FeedKind } from "../../src/feed/types";
import type { Profile } from "../../src/memory/profile/types";

const NOW = new Date("2026-11-07T12:00:00Z");

const profile = (extra: Partial<Profile> = {}): Profile => ({ targetRoles: [], goals: [], skills: [], education: [], experience: [], projects: [], certifications: [], ...extra });

function item(id: string, kind: FeedKind, title: string, extra: { tags?: string[]; text?: string; where?: string; startsAt?: string; level?: string } = {}): Candidate {
  return {
    card: { id, kind, title, org: "Org", url: `https://example.org/${id}`, source: "Curated", where: extra.where, tags: extra.tags, level: extra.level },
    text: extra.text ?? `${title} ${(extra.tags ?? []).join(" ")}`,
    startsAt: extra.startsAt,
  };
}

const reasonsOf = (candidate: Candidate, criteria: FeedCriteria) => rankCandidates([candidate], criteria, NOW)[0].reasons;

const criteriaProfile = profile({ targetRoles: ["Junior developer"], skills: [{ name: "Python", source: "resume" }, { name: "SQL", source: "resume" }] });

describe("reasons a card is in the feed", () => {
  it("names the role goal, the skills the item uses, and the fit for a first role, and makes the first one the why line", () => {
    const criteria = criteriaFrom(criteriaProfile);
    const [card] = rankCandidates([item("j", "job", "Junior Developer", { text: "Python and SQL daily" })], criteria, NOW);
    expect(card.reasons).toEqual(["Fits your goal: Junior developer", "Uses Python and SQL from your profile", "Entry level, a good first role"]);
    expect(card.why).toBe(card.reasons[0]);
  });

  it("points at a project of theirs whose words overlap the item", () => {
    const criteria = criteriaFrom(profile({ projects: [{ name: "Flask API", summary: "A REST API for recipes" }] }));
    expect(reasonsOf(item("h", "hackathon", "API jam", { tags: ["flask", "hackathon"] }), criteria)).toContain("Fits your Flask API project");
  });

  it("points at past work when its highlights overlap the item, but not on filler words", () => {
    const criteria = criteriaFrom(profile({ experience: [{ role: "Data analyst", org: "ATB", highlights: ["Built dashboards in Power BI for the team"] }] }));
    expect(reasonsOf(item("e", "event", "Dashboards night", { tags: ["power bi"] }), criteria)).toContain("Fits your Data analyst work");
    expect(reasonsOf(item("f", "event", "Team social", { tags: ["networking"] }), criteria)).not.toContain("Fits your Data analyst work");
  });

  it("calls a beginner-friendly hackathon a good first one only for an early-career profile", () => {
    const student = criteriaFrom(profile({ education: [{ school: "SAIT", program: "Software Development", expectedGraduation: "2027" }] }));
    const senior = criteriaFrom(profile({ targetRoles: ["Staff engineer"], experience: [{ role: "Lead", org: "A" }, { role: "Senior", org: "B" }] }));
    const hack = item("h", "hackathon", "HackED Beta", { tags: ["beginner", "hackathon"] });
    expect(reasonsOf(hack, student)).toContain("Beginner friendly, good first hackathon");
    expect(reasonsOf(hack, senior)).not.toContain("Beginner friendly, good first hackathon");
    expect(reasonsOf(item("c", "course", "Intro to SQL", { level: "beginner" }), student)).toContain("Beginner friendly, good first course");
    expect(reasonsOf(item("j", "job", "Junior QA", { text: "entry level role" }), student)).toContain("Entry level, a good first role");
  });

  it("notices when both the person and the item lean on AI", () => {
    const criteria = criteriaFrom(profile({ skills: [{ name: "ChatGPT", source: "self-reported" }] }));
    expect(reasonsOf(item("h", "hackathon", "Build weekend", { tags: ["ai", "llm"] }), criteria)).toContain("Uses AI like you do");
    expect(reasonsOf(item("e", "event", "Pottery night", { tags: ["craft"] }), criteria)).not.toContain("Uses AI like you do");
    expect(reasonsOf(item("x", "hackathon", "AI jam", { tags: ["ai"] }), criteriaFrom(profile()))).not.toContain("Uses AI like you do");
  });

  it("mentions being nearby and coming up soon", () => {
    const criteria: FeedCriteria = { roles: [], skills: [], location: "Calgary" };
    expect(reasonsOf(item("e", "event", "Mixer", { where: "Calgary, AB", startsAt: "2026-11-20" }), criteria)).toEqual(["Near you in Calgary", "Coming up Nov 20"]);
  });

  it("keeps at most three reasons, each at most sixty characters, and a true line about the item when nothing matches", () => {
    const longRole = "Senior principal distinguished staff platform reliability engineer";
    const criteria = criteriaFrom(profile({ targetRoles: [longRole], skills: [{ name: "Python", source: "resume" }], projects: [{ name: "Flask API" }] }));
    const reasons = reasonsOf(item("j", "job", longRole, { text: `${longRole} python flask ai`, where: "Calgary" }), { ...criteria, location: "Calgary", usesAI: true });
    expect(reasons).toHaveLength(3);
    for (const reason of reasons) expect(reason.length).toBeLessThanOrEqual(60);
    expect(reasons[0]).toMatch(/^Fits your goal: Senior principal/);
    expect(reasonsOf(item("b", "event", "Bingo", { tags: ["fun"] }), { roles: [], skills: [] })).toEqual(["Open to everyone"]);
  });
});
