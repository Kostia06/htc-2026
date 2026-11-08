import { describe, expect, it } from "vitest";
import { jobCandidate, jobCandidates } from "../../src/feed/jobs";
import type { JobPosting } from "../../src/integrations/adzuna";

const posting = {
  title: "Junior Data Analyst",
  company: "ATB",
  location: "Calgary, AB",
  description: "  Build dashboards in   Power BI and SQL for the retail team.\nWork with analysts…  ",
  url: "https://www.adzuna.ca/details/123",
  posted_at: "2026-11-01T00:00:00Z",
  salary: { min: 55000, max: 65000, estimated: false, label: "$55,000–$65,000" },
};

describe("job cards", () => {
  it("carry the listing's description, whitespace tidied, so the app can show it before sending people off-site", () => {
    const { card } = jobCandidate(posting as never);
    expect(card.summary).toBe("Build dashboards in Power BI and SQL for the retail team. Work with analysts…");
    expect(card.salary).toBe("$55,000–$65,000");
  });

  it("leave the summary out when Adzuna sent no description", () => {
    const { card } = jobCandidate({ ...posting, description: "   ", salary: undefined } as never);
    expect(card).not.toHaveProperty("summary");
    expect(card).not.toHaveProperty("salary");
  });

  it("drop postings over thirty days old, keeping undated ones", async () => {
    const now = new Date("2026-11-08T12:00:00Z");
    const at = (id: string, posted_at: string) => ({ ...posting, url: `https://www.adzuna.ca/details/${id}`, posted_at }) as JobPosting;
    const search = async () => [at("fresh", "2026-11-06T00:00:00Z"), at("old", "2026-09-20T00:00:00Z"), at("undated", "")];
    const ids = (await jobCandidates(search, [{ what: "data analyst" }], now)).map((c) => c.card.id);
    expect(ids).toEqual(["job:fresh", "job:undated"]);
  });

  it("drop senior, lead and manager postings: Skillit is for landing a first job", async () => {
    const at = (id: string, title: string) => ({ ...posting, url: `https://www.adzuna.ca/details/${id}`, title }) as JobPosting;
    const search = async () => [
      at("sr", "Sr. Software Engineer"),
      at("senior", "Senior Data Analyst"),
      at("lead", "Lead Developer"),
      at("staff", "Staff Engineer"),
      at("mgr", "Engineering Manager"),
      at("dir", "Director of Data"),
      at("principal", "Principal Architect"),
      at("iii", "Software Developer III"),
      at("junior", "Junior Developer"),
      at("intern", "Data Analyst Intern"),
      at("plain", "Software Developer"),
      at("leader", "Team Leader in Training"),
    ];
    const ids = (await jobCandidates(search, [{ what: "developer" }])).map((c) => c.card.id);
    expect(ids).toEqual(["job:junior", "job:intern", "job:plain", "job:leader"]);
  });
});
