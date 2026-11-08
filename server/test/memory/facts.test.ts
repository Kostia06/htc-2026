import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deps, saveFact } from "../../src/memory/facts";

describe("saveFact", () => {
  beforeEach(async () => {
    vi.spyOn(deps, "upsertVector").mockResolvedValue();
    await env.DB.prepare("INSERT OR IGNORE INTO companies (id, slug, name) VALUES ('c1', 'acme', 'Acme')").run();
  });

  it("stores a fact with its source and fetch time", async () => {
    const out = await saveFact(env, "c1", { kind: "hiring", text: "Hiring juniors", source_url: "https://acme.com/careers" });
    expect(out.saved).toBe(true);
    const row = await env.DB.prepare("SELECT source_url, fetched_at FROM company_facts").first<{ source_url: string; fetched_at: string }>();
    expect(row?.source_url).toBe("https://acme.com/careers");
    expect(row?.fetched_at).toBeTruthy();
  });

  it("stores interview_process facts", async () => {
    const out = await saveFact(env, "c1", { kind: "interview_process", text: "Phone screen, then onsite", source_url: "https://acme.com/hiring" });
    expect(out.saved).toBe(true);
    const row = await env.DB.prepare("SELECT kind FROM company_facts").first<{ kind: string }>();
    expect(row?.kind).toBe("interview_process");
  });

  it("ignores a duplicate fact", async () => {
    const fact = { kind: "hiring" as const, text: "Hiring juniors", source_url: "https://acme.com/careers" };
    await saveFact(env, "c1", fact);
    const again = await saveFact(env, "c1", fact);
    expect(again).toEqual({ saved: false, reason: "duplicate" });
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM company_facts").first<{ n: number }>();
    expect(n?.n).toBe(1);
  });

  it("refreshes the fetch time when a fact is seen again", async () => {
    const fact = { kind: "hiring" as const, text: "Hiring juniors", source_url: "https://acme.com/careers" };
    await saveFact(env, "c1", fact);
    await env.DB.prepare("UPDATE company_facts SET fetched_at = '2020-01-01T00:00:00.000Z'").run();

    await saveFact(env, "c1", fact);

    const row = await env.DB.prepare("SELECT fetched_at FROM company_facts").first<{ fetched_at: string }>();
    expect(row!.fetched_at > "2020-01-01T00:00:00.000Z").toBe(true);
    expect(deps.upsertVector).toHaveBeenCalledTimes(1);
  });
});
