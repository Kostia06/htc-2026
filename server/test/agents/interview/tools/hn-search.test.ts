import { describe, expect, it, vi } from "vitest";
import { hnSearch } from "../../../../src/agents/interview/tools/hn-search";
import type { HackerNewsHit } from "../../../../src/integrations/hacker-news";
import { fakeServices, toolContext } from "../../fakes";

const hit: HackerNewsHit = {
  title: "Ask HN: Interviewing at Acme?",
  url: "https://news.ycombinator.com/item?id=1",
  link: null,
  author: "sam",
  points: null,
  created_at: "2026-10-01T00:00:00Z",
  excerpt: "Two rounds.",
};

describe("hn_search", () => {
  it("returns Hacker News hits labelled as anecdotes, with the excerpt marked untrusted", async () => {
    const ctx = toolContext({ services: fakeServices({ hackerNews: vi.fn(async () => [hit]) }) });
    const out = (await hnSearch.run({ query: "acme interview" }, ctx)) as { note: string; results: (HackerNewsHit & { label: string })[] };
    expect(ctx.services.hackerNews).toHaveBeenCalledWith("acme interview");
    expect(out.results[0]).toMatchObject({ url: hit.url, author: "sam", label: "anecdote" });
    expect(out.note).toMatch(/untrusted/i);
    expect(out.note).toMatch(/fetch_page/);
  });

  it("needs a query", async () => {
    const ctx = toolContext();
    expect(await hnSearch.run({ query: " " }, ctx)).toMatchObject({ error: expect.any(String) });
    expect(ctx.services.hackerNews).not.toHaveBeenCalled();
  });

  it("reports a failed search instead of throwing", async () => {
    const ctx = toolContext({ services: fakeServices({ hackerNews: vi.fn(async () => Promise.reject(new Error("HN search HTTP 503"))) }) });
    expect(await hnSearch.run({ query: "acme" }, ctx)).toEqual({ error: "HN search HTTP 503" });
  });
});
