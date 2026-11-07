import { describe, expect, it, vi } from "vitest";
import { makeTools, type ToolDeps } from "../src/agent/tools";

function fakeDeps(over: Partial<ToolDeps> = {}): ToolDeps {
  return {
    search: vi.fn(async () => [
      { title: "Acme careers", url: "https://acme.com/careers", snippet: "We hire juniors" },
      { title: "Acme reviews", url: "https://www.glassdoor.ca/acme", snippet: "..." },
    ]),
    fetchPage: vi.fn(async () => "Acme interviews have a take-home."),
    fetchRobots: vi.fn(async () => ""),
    memorySearch: vi.fn(async () => []),
    saveFact: vi.fn(async () => ({ saved: true })),
    ...over,
  };
}

describe("agent tools", () => {
  it("web_search drops results from blocked hosts", async () => {
    const tools = makeTools(fakeDeps(), "c1");
    const out = (await tools.web_search.run({ query: "acme" })) as { results: { url: string }[] };
    expect(out.results.map((r) => r.url)).toEqual(["https://acme.com/careers"]);
  });

  it("fetch_page refuses blocked hosts without fetching", async () => {
    const deps = fakeDeps();
    const out = await makeTools(deps, "c1").fetch_page.run({ url: "https://www.linkedin.com/company/acme" });
    expect(out).toMatchObject({ skipped: true });
    expect(deps.fetchPage).not.toHaveBeenCalled();
  });

  it("fetch_page respects robots.txt", async () => {
    const deps = fakeDeps({ fetchRobots: vi.fn(async () => "User-agent: *\nDisallow: /careers") });
    const out = await makeTools(deps, "c1").fetch_page.run({ url: "https://acme.com/careers/jobs" });
    expect(out).toMatchObject({ skipped: true });
    expect(deps.fetchPage).not.toHaveBeenCalled();
  });

  it("fetch_page reports a 403 as skipped and does not retry", async () => {
    const deps = fakeDeps({ fetchPage: vi.fn(async () => { throw new Error("HTTP 403"); }) });
    const out = await makeTools(deps, "c1").fetch_page.run({ url: "https://acme.com/about" });
    expect(out).toMatchObject({ skipped: true });
    expect(deps.fetchPage).toHaveBeenCalledTimes(1);
  });

  it("save_fact rejects a missing or blocked source", async () => {
    const deps = fakeDeps();
    const tools = makeTools(deps, "c1");
    expect(await tools.save_fact.run({ kind: "hiring", text: "x", source_url: "" })).toMatchObject({ saved: false });
    expect(await tools.save_fact.run({ kind: "hiring", text: "x", source_url: "https://glassdoor.com/a" })).toMatchObject({ saved: false });
    expect(deps.saveFact).not.toHaveBeenCalled();
  });

  it("save_fact passes a good fact through to memory", async () => {
    const deps = fakeDeps();
    await makeTools(deps, "c1").save_fact.run({ kind: "interview", text: "Two rounds", source_url: "https://acme.com/careers" });
    expect(deps.saveFact).toHaveBeenCalledWith("c1", { kind: "interview", text: "Two rounds", source_url: "https://acme.com/careers" });
  });
});
