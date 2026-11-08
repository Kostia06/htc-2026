import { describe, expect, it } from "vitest";
import { CURATED_VERSION, curatedItems } from "../../src/feed/curated";
import { curatedCandidates } from "../../src/feed/curation";
import { FEED_FIELDS } from "../../src/feed/types";

const NOW = new Date("2026-11-07T12:00:00Z");
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

describe("curated events, hackathons and courses", () => {
  it("is versioned and every item has a unique id prefixed by its kind", () => {
    expect(CURATED_VERSION).toBeGreaterThan(0);
    const ids = curatedItems.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of curatedItems) expect(item.id.startsWith(`${item.kind}:`)).toBe(true);
  });

  it("links every item over https and tags it with at least one known field", () => {
    for (const item of curatedItems) {
      expect(item.url).toMatch(/^https:\/\//);
      expect(item.fields.length).toBeGreaterThan(0);
      for (const field of item.fields) expect(FEED_FIELDS).toContain(field);
      expect(item.tags.length).toBeGreaterThan(0);
    }
  });

  it("gives each item a date as the source states it: an ISO day, or a short label such as ongoing", () => {
    for (const item of curatedItems) {
      expect(item.when.length).toBeGreaterThan(0);
      if (!ISO_DAY.test(item.when)) expect(item.when.length).toBeLessThanOrEqual(24);
    }
  });

  it("covers computer science, business, design and health, with every kind present", () => {
    for (const field of ["cs", "business", "design", "health"] as const) {
      expect(curatedItems.some((i) => i.fields.includes(field) && i.kind === "event")).toBe(true);
      expect(curatedItems.some((i) => i.fields.includes(field) && i.kind === "course")).toBe(true);
    }
    expect(curatedItems.some((i) => i.kind === "hackathon")).toBe(true);
  });

  it("drops dated items that have already happened and keeps undated ones", () => {
    const candidates = curatedCandidates(NOW);
    for (const c of candidates) {
      if (c.startsAt) expect(Date.parse(c.startsAt)).toBeGreaterThanOrEqual(NOW.getTime() - 86_400_000);
    }
    expect(candidates.some((c) => c.card.when === "ongoing")).toBe(true);
    expect(candidates.length).toBeGreaterThan(20);
  });

  it("turns an item into a candidate the ranker can match on title, org and tags", () => {
    const [candidate] = curatedCandidates(NOW).filter((c) => c.card.id === "course:google-ux-design");
    expect(candidate.card.kind).toBe("course");
    expect(candidate.card.where).toBe("Online");
    expect(candidate.card.tags).toContain("figma");
    expect(candidate.text.toLowerCase()).toContain("figma");
    expect(candidate.fields).toEqual(["design"]);
  });
});
