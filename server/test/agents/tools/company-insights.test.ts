import { describe, expect, it, vi } from "vitest";
import type { CompanyInsights } from "../../../src/agents/core/types";
import { companyInsights } from "../../../src/agents/tools/company-insights";
import { ACME, fakeServices, toolContext } from "../fakes";

const insights: CompanyInsights = {
  company: { ...ACME, last_researched_at: null },
  facts: [{ kind: "interview", text: "Two rounds", source_url: "https://acme.com/careers", fetched_at: "2026-11-01" }],
  reportCount: 3,
  questions: [{ text: "Tell me about a bug you fixed", count: 3, example: false }],
};

describe("company_insights", () => {
  it("returns facts and reported questions for the run's company", async () => {
    const ctx = toolContext({ services: fakeServices({ companyInsights: vi.fn(async () => insights) }) });
    const out = await companyInsights.run({ role: "Junior Developer" }, ctx);
    expect(ctx.services.companyInsights).toHaveBeenCalledWith("acme", "Junior Developer");
    expect(out).toEqual({
      company: "Acme",
      reportCount: 3,
      facts: [{ kind: "interview", text: "Two rounds", source_url: "https://acme.com/careers" }],
      questions: [{ text: "Tell me about a bug you fixed", count: 3, example: false }],
    });
  });

  it("can look up another company by slug", async () => {
    const ctx = toolContext({ company: undefined, services: fakeServices({ companyInsights: vi.fn(async () => insights) }) });
    await companyInsights.run({ company: "globex" }, ctx);
    expect(ctx.services.companyInsights).toHaveBeenCalledWith("globex", undefined);
  });

  it("says so when the company is unknown", async () => {
    expect(await companyInsights.run({ company: "nope" }, toolContext())).toMatchObject({ error: "unknown company nope" });
  });
});
