import { describe, expect, it } from "vitest";
import { diversify, sectionsFrom } from "../../src/feed/sections";
import type { FeedCard, FeedKind } from "../../src/feed/types";

const card = (id: string, kind: FeedKind): FeedCard => ({ id, kind, title: id, org: "Org", why: "Open to everyone", reasons: [], url: `https://example.org/${id}`, source: "Test" });
const kinds = (cards: FeedCard[]) => cards.map((c) => c.kind[0]).join("");

describe("feed sections", () => {
  it("splits the ranked list by kind, keeping each section in rank order", () => {
    const ranked = [card("j1", "job"), card("e1", "event"), card("j2", "job"), card("h1", "hackathon"), card("c1", "course")];
    const sections = sectionsFrom(ranked);
    expect(sections.jobs.map((c) => c.id)).toEqual(["j1", "j2"]);
    expect(sections.events.map((c) => c.id)).toEqual(["e1"]);
    expect(sections.hackathons.map((c) => c.id)).toEqual(["h1"]);
    expect(sections.courses.map((c) => c.id)).toEqual(["c1"]);
  });

  it("breaks up long runs of one kind in For you while another kind is still waiting", () => {
    const ranked = [...Array.from({ length: 5 }, (_, i) => card(`j${i}`, "job")), card("e1", "event"), card("c1", "course")];
    expect(kinds(diversify(ranked, 2))).toBe("jjejjcj");
  });

  it("leaves the order alone once only one kind is left", () => {
    const ranked = [card("e1", "event"), ...Array.from({ length: 4 }, (_, i) => card(`j${i}`, "job"))];
    expect(diversify(ranked, 2).map((c) => c.id)).toEqual(["e1", "j0", "j1", "j2", "j3"]);
  });

  it("caps For you at sixty cards", () => {
    const ranked = Array.from({ length: 80 }, (_, i) => card(`j${i}`, "job"));
    expect(sectionsFrom(ranked).all).toHaveLength(60);
  });
});
