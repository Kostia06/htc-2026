import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { adzunaSearch } from "../../src/integrations/adzuna";

afterEach(() => vi.restoreAllMocks());

const keyed = { ...env, ADZUNA_APP_ID: "app123", ADZUNA_APP_KEY: "secret456" };

const description = `${"Build and test web services. ".repeat(20).slice(0, 499)}…`;
const raw = {
  id: "5012345678",
  title: "Junior Software Developer",
  company: { display_name: "Acme" },
  location: { display_name: "Calgary, Alberta", area: ["Canada", "Alberta", "Calgary"] },
  category: { label: "IT Jobs" },
  created: "2026-11-01T10:00:00Z",
  contract_time: "full_time",
  salary_is_predicted: "0",
  description,
  redirect_url: "https://www.adzuna.ca/details/5012345678?utm_medium=api&utm_source=app123",
};

describe("adzuna client", () => {
  it("searches Canadian jobs with our keys and maps each listing", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ results: [raw], count: 1 }));
    const [posting] = await adzunaSearch(keyed, { what: "software developer", where: "Calgary" });

    const url = new URL(spy.mock.calls[0][0] as string);
    expect(url.origin + url.pathname).toBe("https://api.adzuna.com/v1/api/jobs/ca/search/1");
    expect(url.searchParams.get("app_id")).toBe("app123");
    expect(url.searchParams.get("what")).toBe("software developer");
    expect(url.searchParams.get("where")).toBe("Calgary");
    // old postings are mostly filled; Adzuna leaves them out before they cost us a result slot
    expect(url.searchParams.get("max_days_old")).toBe("30");

    expect(posting).toMatchObject({
      title: "Junior Software Developer",
      company: "Acme",
      location: "Calgary, Alberta",
      posted_at: "2026-11-01T10:00:00Z",
      contract_time: "full_time",
      attribution: "Jobs by Adzuna",
      attribution_url: "https://www.adzuna.ca",
    });
    expect(posting.description).toBe(description);
    expect(posting).not.toHaveProperty("salary");
    expect(posting).not.toHaveProperty("contract_type");
  });

  it("links to the Adzuna listing without leaking our app id", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ results: [raw] }));
    const [posting] = await adzunaSearch(keyed, { what: "developer" });
    expect(posting.url).toBe("https://www.adzuna.ca/details/5012345678");
    expect(JSON.stringify(posting)).not.toContain("app123");
  });

  it("labels a predicted salary as an Adzuna estimate", async () => {
    const withSalary = { ...raw, salary_min: 60000, salary_max: 70000, salary_is_predicted: "1", contract_type: "permanent" };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ results: [withSalary] }));
    const [posting] = await adzunaSearch(keyed, { what: "developer" });
    expect(posting.salary).toEqual({ min: 60000, max: 70000, estimated: true, label: "Adzuna Jobsworth estimate" });
    expect(posting.contract_type).toBe("permanent");
  });

  it("refuses to run without keys and never calls out", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    await expect(adzunaSearch({ ...env, ADZUNA_APP_ID: "", ADZUNA_APP_KEY: "" }, { what: "x" })).rejects.toThrow(/not configured/);
    expect(spy).not.toHaveBeenCalled();
  });

  it("does not echo the key in errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 401 }));
    await expect(adzunaSearch(keyed, { what: "x" })).rejects.toThrow("Adzuna HTTP 401");
  });
});
