import { describe, expect, it } from "vitest";
import { rankCandidates } from "../../src/feed/rank";
import type { Candidate, FeedCriteria, FeedField } from "../../src/feed/types";

const NOW = new Date("2026-11-07T12:00:00Z");

function item(id: string, title: string, extra: { fields?: FeedField[]; tags?: string[]; startsAt?: string; where?: string; text?: string } = {}): Candidate {
  return {
    card: { id, kind: "event", title, org: "Org", url: `https://example.org/${id}`, source: "Curated", where: extra.where, tags: extra.tags },
    text: extra.text ?? `${title} ${(extra.tags ?? []).join(" ")}`,
    fields: extra.fields,
    startsAt: extra.startsAt,
  };
}

const criteria: FeedCriteria = { roles: ["Nurse"], skills: ["Python"], fields: ["health"], avoidTags: [] };

describe("personal ranking of events, hackathons and courses", () => {
  it("ranks an item in the person's field above a general one above an unrelated one, and says so", () => {
    const ranked = rankCandidates([item("art", "Art talk", { fields: ["design"] }), item("care", "Care careers night", { fields: ["health"] }), item("any", "Library hour", { fields: ["general"] })], criteria, NOW);
    expect(ranked.map((c) => c.id)).toEqual(["care", "any", "art"]);
    expect(ranked[0].why).toBe("In your field: health");
    expect(ranked[1].why).toBe("Open to everyone");
  });

  it("pushes down cards tagged like something the person dismissed", () => {
    const avoid: FeedCriteria = { ...criteria, avoidTags: ["hackathon"] };
    const ranked = rankCandidates([item("hack", "Weekend build", { fields: ["health"], tags: ["hackathon"] }), item("talk", "Clinic talk", { fields: ["health"] })], avoid, NOW);
    expect(ranked.map((c) => c.id)).toEqual(["talk", "hack"]);
  });

  it("prefers what is coming up soon and dates the why line", () => {
    const ranked = rankCandidates([item("later", "Mixer", { startsAt: "2027-01-20" }), item("soon", "Mixer", { startsAt: "2026-11-20" })], { roles: [], skills: [] }, NOW);
    expect(ranked.map((c) => c.id)).toEqual(["soon", "later"]);
    expect(ranked[0].why).toBe("Coming up Nov 20");
  });

  it("matches a tag like a skill, whole word only", () => {
    const ranked = rankCandidates([item("py", "Data night", { tags: ["python", "sql"] }), item("js", "Web night", { tags: ["javascript"] })], criteria, NOW);
    expect(ranked[0].id).toBe("py");
    expect(ranked[0].why).toBe("Uses Python from your profile");
  });

  it("explains a course with no other match as free to start any time", () => {
    const course: Candidate = { card: { id: "c", kind: "course", title: "Finance basics", org: "Khan Academy", url: "https://example.org/c", source: "Curated" }, text: "finance" };
    expect(rankCandidates([course], { roles: [], skills: [] }, NOW)[0].why).toBe("Free, start any time");
  });
});
