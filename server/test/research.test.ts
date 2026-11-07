import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GeminiContent } from "../src/ai/gemini";
import { deps as researchDeps, researchCompany } from "../src/agent/research";
import app from "../src/index";
import { issueSession } from "../src/session";

describe("researchCompany", () => {
  beforeEach(async () => {
    await env.DB.prepare("INSERT INTO companies (id, slug, name, website) VALUES ('c1', 'acme', 'Acme', 'https://acme.com')").run();
  });

  it("lets the model save sourced facts and stamps the company", async () => {
    const replies: GeminiContent[] = [
      { role: "model", parts: [{ functionCall: { name: "save_fact", args: { kind: "hiring", text: "Acme hires juniors in Calgary", source_url: "https://acme.com/careers" } } }] },
      { role: "model", parts: [{ text: "Saved 1 fact." }] },
    ];
    const saveFact = vi.fn(async () => ({ saved: true }));
    vi.spyOn(researchDeps, "model").mockReturnValue(async () => replies.shift()!);
    vi.spyOn(researchDeps, "tools").mockReturnValue({
      search: async () => [],
      fetchPage: async () => "",
      fetchRobots: async () => "",
      memorySearch: async () => [],
      saveFact,
    });

    const out = await researchCompany(env, "acme");
    expect(out.added).toBe(1);
    expect(saveFact).toHaveBeenCalledOnce();
    const row = await env.DB.prepare("SELECT last_researched_at FROM companies WHERE id = 'c1'").first<{ last_researched_at: string | null }>();
    expect(row?.last_researched_at).toBeTruthy();
  });

  it("returns 404 from the route for an unknown company", async () => {
    const token = await issueSession(env.SESSION_SECRET);
    const res = await app.request("/api/research/nope", { method: "POST", headers: { Authorization: `Bearer ${token}` } }, env);
    expect(res.status).toBe(404);
  });

  it("refuses to research the same company again within 30 minutes", async () => {
    await env.DB.prepare("UPDATE companies SET last_researched_at = ? WHERE id = 'c1'").bind(new Date().toISOString()).run();
    const token = await issueSession(env.SESSION_SECRET);
    const res = await app.request("/api/research/acme", { method: "POST", headers: { Authorization: `Bearer ${token}` } }, env);
    expect(res.status).toBe(429);
  });
});
