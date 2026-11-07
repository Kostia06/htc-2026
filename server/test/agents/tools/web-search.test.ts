import { describe, expect, it, vi } from "vitest";
import { webSearch } from "../../../src/agents/tools/web-search";
import { fakeServices, toolContext } from "../fakes";

type Out = { note: string; results: { url: string; snippet: string; label?: string }[] };

const searching = (results: { title: string; url: string; snippet: string }[]) =>
  toolContext({ services: fakeServices({ search: vi.fn(async () => results) }) });

describe("web_search", () => {
  it("drops results from blocked hosts", async () => {
    const out = (await webSearch.run({ query: "acme" }, toolContext())) as Out;
    expect(out.results.map((r) => r.url)).toEqual(["https://acme.com/careers"]);
  });

  it("labels the results as untrusted web data", async () => {
    const out = (await webSearch.run({ query: "acme" }, toolContext())) as Out;
    expect(out.note).toMatch(/untrusted/i);
  });

  it("keeps a Reddit thread only as a short, labelled anecdote", async () => {
    const thread = { title: "Acme interview", url: "https://www.reddit.com/r/calgary/comments/1/acme/", snippet: "x".repeat(600) };
    const out = (await webSearch.run({ query: "acme interview" }, searching([thread]))) as Out;
    expect(out.results).toHaveLength(1);
    expect(out.results[0].label).toBe("anecdote");
    expect(out.results[0].snippet.length).toBeLessThanOrEqual(300);
    expect(out.note).toMatch(/anecdote/i);
  });

  it("leaves ordinary results unlabelled", async () => {
    const out = (await webSearch.run({ query: "acme" }, searching([{ title: "A", url: "https://acme.com", snippet: "s" }]))) as Out;
    expect(out.results[0]).not.toHaveProperty("label");
  });
});
