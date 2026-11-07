import { afterEach, describe, expect, it, vi } from "vitest";
import { hackerNewsSearch } from "../../src/integrations/hacker-news";

afterEach(() => vi.restoreAllMocks());

const story = {
  objectID: "41000001",
  title: "How we hire engineers at Acme",
  url: "https://acme.com/blog/how-we-hire",
  author: "pat",
  points: 120,
  created_at: "2026-09-01T12:00:00Z",
  story_text: null,
};
const comment = {
  objectID: "41000002",
  story_title: "Ask HN: Interviewing at Acme?",
  author: "sam",
  points: null,
  created_at: "2026-10-01T12:00:00Z",
  comment_text: "<p>Two rounds: a take-home &amp; a <i>pairing</i> session.</p>",
};

describe("hacker news client", () => {
  it("searches recent stories and comments on Algolia", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ hits: [] }));
    await hackerNewsSearch("acme interview", new Date("2026-11-07T00:00:00Z"));
    const url = new URL(spy.mock.calls[0][0] as string);
    expect(url.origin + url.pathname).toBe("https://hn.algolia.com/api/v1/search");
    expect(url.searchParams.get("query")).toBe("acme interview");
    expect(url.searchParams.get("tags")).toBe("(story,comment)");
    expect(url.searchParams.get("numericFilters")).toMatch(/^created_at_i>\d+$/);
  });

  it("links every hit to its HN item and keeps a short plain-text excerpt", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ hits: [story, comment] }));
    const [first, second] = await hackerNewsSearch("acme");
    expect(first).toMatchObject({
      title: "How we hire engineers at Acme",
      url: "https://news.ycombinator.com/item?id=41000001",
      link: "https://acme.com/blog/how-we-hire",
      author: "pat",
      points: 120,
    });
    expect(second).toMatchObject({ title: "Ask HN: Interviewing at Acme?", link: null, points: null });
    expect(second.excerpt).toBe("Two rounds: a take-home & a pairing session.");
  });

  it("throws on an HTTP error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 503 }));
    await expect(hackerNewsSearch("acme")).rejects.toThrow("HN search HTTP 503");
  });
});
