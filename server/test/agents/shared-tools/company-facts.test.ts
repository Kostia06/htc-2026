import { describe, expect, it, vi } from "vitest";
import { companyFacts } from "../../../src/agents/shared-tools/company-facts";
import { fakeServices, toolContext } from "../fakes";

describe("company_facts", () => {
  it("searches the facts already known about the run's company", async () => {
    const hits = [{ kind: "hiring", text: "Hires juniors", source_url: "https://acme.com/careers", score: 0.9 }];
    const ctx = toolContext({ services: fakeServices({ companyFacts: vi.fn(async () => hits) }) });
    expect(await companyFacts.run({ query: "hiring" }, ctx)).toEqual({ facts: hits });
    expect(ctx.services.companyFacts).toHaveBeenCalledWith("c1", "hiring");
  });

  it("needs a company in the run", async () => {
    expect(await companyFacts.run({ query: "x" }, toolContext({ company: undefined }))).toMatchObject({ error: expect.any(String) });
  });
});
