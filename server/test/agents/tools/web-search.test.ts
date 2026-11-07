import { describe, expect, it } from "vitest";
import { webSearch } from "../../../src/agents/tools/web-search";
import { toolContext } from "../fakes";

describe("web_search", () => {
  it("drops results from blocked hosts", async () => {
    const out = (await webSearch.run({ query: "acme" }, toolContext())) as { results: { url: string }[] };
    expect(out.results.map((r) => r.url)).toEqual(["https://acme.com/careers"]);
  });

  it("labels the results as untrusted web data", async () => {
    const out = (await webSearch.run({ query: "acme" }, toolContext())) as { note: string };
    expect(out.note).toMatch(/untrusted/i);
  });
});
