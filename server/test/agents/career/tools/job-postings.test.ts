import { describe, expect, it, vi } from "vitest";
import { jobPostings } from "../../../../src/agents/career/tools/job-postings";
import { ADZUNA_ATTRIBUTION, type JobPosting } from "../../../../src/integrations/adzuna";
import { fakeServices, toolContext } from "../../fakes";

const posting: JobPosting = {
  title: "Junior Developer",
  company: "Acme",
  location: "Calgary, Alberta",
  posted_at: "2026-11-01T00:00:00Z",
  description: "Short description…",
  url: "https://www.adzuna.ca/details/1",
  ...ADZUNA_ATTRIBUTION,
};

describe("job_postings", () => {
  it("searches Adzuna, defaulting to Calgary, and keeps the attribution on every listing", async () => {
    const search = vi.fn(async () => [posting]);
    const ctx = toolContext({ services: fakeServices({ jobPostings: search }) });
    const out = (await jobPostings.run({ what: "junior developer" }, ctx)) as { postings: JobPosting[]; note: string };
    expect(search).toHaveBeenCalledWith({ what: "junior developer", where: "Calgary" });
    expect(out.postings[0]).toMatchObject({ attribution: "Jobs by Adzuna", attribution_url: "https://www.adzuna.ca" });
    expect(out.note).toMatch(/untrusted/i);
  });

  it("passes another location through", async () => {
    const search = vi.fn(async () => []);
    await jobPostings.run({ what: "analyst", where: "Edmonton" }, toolContext({ services: fakeServices({ jobPostings: search }) }));
    expect(search).toHaveBeenCalledWith({ what: "analyst", where: "Edmonton" });
  });

  it("needs something to search for", async () => {
    const ctx = toolContext();
    expect(await jobPostings.run({}, ctx)).toMatchObject({ error: expect.any(String) });
    expect(ctx.services.jobPostings).not.toHaveBeenCalled();
  });

  it("reports a failed search instead of throwing", async () => {
    const ctx = toolContext({ services: fakeServices({ jobPostings: vi.fn(async () => Promise.reject(new Error("job search is not configured"))) }) });
    expect(await jobPostings.run({ what: "developer" }, ctx)).toEqual({ error: "job search is not configured" });
  });
});
