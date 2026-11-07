import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deps, saveFact } from "../src/memory/facts";

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

  it("ignores a duplicate fact", async () => {
    const fact = { kind: "hiring" as const, text: "Hiring juniors", source_url: "https://acme.com/careers" };
    await saveFact(env, "c1", fact);
    const again = await saveFact(env, "c1", fact);
    expect(again).toEqual({ saved: false, reason: "duplicate" });
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM company_facts").first<{ n: number }>();
    expect(n?.n).toBe(1);
  });
});
