import { describe, expect, it, vi } from "vitest";
import { devtoSearch } from "../../../src/agents/tools/devto-search";
import type { DevtoArticle } from "../../../src/integrations/devto";
import { fakeServices, toolContext } from "../fakes";

const article = (title: string, description = ""): DevtoArticle => ({
  title,
  description,
  url: `https://dev.to/a/${encodeURIComponent(title)}`,
  author: "Sam",
  published_at: "2026-10-01T00:00:00Z",
  tags: ["interview"],
});

type Out = { note: string; results: DevtoArticle[] };

describe("devto_search", () => {
  it("lists articles for the interview tag by default", async () => {
    const list = vi.fn(async () => [article("My interview loop")]);
    const out = (await devtoSearch.run({}, toolContext({ services: fakeServices({ devtoArticles: list }) }))) as Out;
    expect(list).toHaveBeenCalledWith("interview");
    expect(out.results).toHaveLength(1);
    expect(out.note).toMatch(/untrusted/i);
  });

  it("keeps only articles that mention the keyword", async () => {
    const list = vi.fn(async () => [article("Interviewing at Acme"), article("FAANG prep"), article("Onsite tips", "How ACME runs onsites")]);
    const out = (await devtoSearch.run({ keyword: "acme" }, toolContext({ services: fakeServices({ devtoArticles: list }) }))) as Out;
    expect(out.results.map((a) => a.title)).toEqual(["Interviewing at Acme", "Onsite tips"]);
  });

  it("reduces the tag to the letters and digits dev.to accepts", async () => {
    const list = vi.fn(async () => []);
    await devtoSearch.run({ tag: "Career Advice!" }, toolContext({ services: fakeServices({ devtoArticles: list }) }));
    expect(list).toHaveBeenCalledWith("careeradvice");
  });

  it("reports a failed listing instead of throwing", async () => {
    const ctx = toolContext({ services: fakeServices({ devtoArticles: vi.fn(async () => Promise.reject(new Error("dev.to HTTP 429"))) }) });
    expect(await devtoSearch.run({}, ctx)).toEqual({ error: "dev.to HTTP 429" });
  });
});
