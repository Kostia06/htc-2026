import { describe, expect, it, vi } from "vitest";
import { fetchPage } from "../../../src/agents/tools/fetch-page";
import { saveFact } from "../../../src/agents/tools/save-fact";
import { fakeServices, toolContext } from "../fakes";

describe("save_fact", () => {
  it("rejects a missing or blocked source", async () => {
    const ctx = toolContext();
    expect(await saveFact.run({ kind: "hiring", text: "x", source_url: "" }, ctx)).toMatchObject({ saved: false });
    expect(await saveFact.run({ kind: "hiring", text: "x", source_url: "https://glassdoor.com/a" }, ctx)).toMatchObject({ saved: false });
    expect(ctx.services.saveFact).not.toHaveBeenCalled();
  });

  it("passes a good fact through to company memory", async () => {
    const ctx = toolContext();
    await fetchPage.run({ url: "https://acme.com/careers" }, ctx);
    await saveFact.run({ kind: "interview", text: "Two rounds", source_url: "https://acme.com/careers" }, ctx);
    expect(ctx.services.saveFact).toHaveBeenCalledWith("c1", { kind: "interview", text: "Two rounds", source_url: "https://acme.com/careers" });
  });

  it("only accepts a source fetched in this run", async () => {
    const ctx = toolContext();
    const fact = { kind: "hiring", text: "Two rounds", source_url: "https://acme.com/careers" };
    expect(await saveFact.run(fact, ctx)).toMatchObject({ saved: false });
    await fetchPage.run({ url: "https://acme.com/careers" }, ctx);
    expect(await saveFact.run(fact, ctx)).toMatchObject({ saved: true });
  });

  it("does not trust a page fetched in a different run", async () => {
    const earlier = toolContext();
    await fetchPage.run({ url: "https://acme.com/careers" }, earlier);
    const fact = { kind: "hiring", text: "Two rounds", source_url: "https://acme.com/careers" };
    expect(await saveFact.run(fact, toolContext())).toMatchObject({ saved: false });
  });

  it("rejects a source whose fetch was skipped", async () => {
    const ctx = toolContext({ services: fakeServices({ fetchPage: vi.fn(async () => { throw new Error("HTTP 403"); }) }) });
    await fetchPage.run({ url: "https://acme.com/about" }, ctx);
    expect(await saveFact.run({ kind: "about", text: "x", source_url: "https://acme.com/about" }, ctx)).toMatchObject({ saved: false });
  });

  it("needs a company in the run", async () => {
    const ctx = toolContext({ company: undefined });
    expect(await saveFact.run({ kind: "about", text: "x", source_url: "https://acme.com" }, ctx)).toMatchObject({ saved: false });
  });
});
