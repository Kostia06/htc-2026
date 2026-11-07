import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimResearch, researchTracked, runResearch, startResearch } from "../../src/agents/background";
import app from "../../src/index";
import { issueSession } from "../../src/auth/session";
import { call, fakeDeps, fakeServices } from "./fakes";

// the real D1-backed claim, so the cooldown is exercised end to end
const claimingServices = (over = {}) => fakeServices({ claimResearch: (slug) => claimResearch(env, slug), ...over });

async function lastResearchedAt(id: string) {
  const row = await env.DB.prepare("SELECT last_researched_at FROM companies WHERE id = ?").bind(id).first<{ last_researched_at: string | null }>();
  return row?.last_researched_at ?? null;
}

describe("background research", () => {
  beforeEach(async () => {
    await env.DB.prepare("INSERT INTO companies (id, slug, name, website, tracked) VALUES ('c1', 'acme', 'Acme', 'https://acme.com', 1)").run();
  });

  it("lets the model save facts from pages it read, and claiming stamps the company", async () => {
    const saveFact = vi.fn(async () => ({ saved: true }));
    const { deps } = fakeDeps({
      services: claimingServices({ saveFact }),
      replies: [
        call("fetch_page", { url: "https://acme.com/careers" }),
        call("save_fact", { kind: "hiring", text: "Acme hires juniors in Calgary", source_url: "https://acme.com/careers" }),
        call("finish", { summary: "Saved 1 fact." }),
      ],
    });

    const out = await runResearch(deps, "acme");
    expect(out).toMatchObject({ status: "done", added: 1, summary: "Saved 1 fact." });
    expect(saveFact).toHaveBeenCalledOnce();
    expect(await lastResearchedAt("c1")).toBeTruthy();
  });

  it("counts only facts that were actually saved", async () => {
    const { deps } = fakeDeps({
      replies: [
        call("save_fact", { kind: "hiring", text: "x", source_url: "https://never-fetched.com" }),
        call("finish", { summary: "done" }),
      ],
    });
    expect((await runResearch(deps, "acme"))?.added).toBe(0);
  });

  it("won't start research on a company researched in the last 30 minutes", async () => {
    await env.DB.prepare("UPDATE companies SET last_researched_at = ? WHERE id = 'c1'").bind(new Date().toISOString()).run();
    const { deps, conversations } = fakeDeps({ services: claimingServices() });
    expect(await startResearch(deps, "acme")).toBeNull();
    expect(conversations).toHaveLength(0);
  });

  it("lets only one of two simultaneous requests claim the research slot", async () => {
    const [a, b] = await Promise.all([claimResearch(env, "acme"), claimResearch(env, "acme")]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
  });

  it("researches tracked companies it can claim, and skips ones on cooldown", async () => {
    await env.DB.prepare("INSERT INTO companies (id, slug, name, tracked, last_researched_at) VALUES ('c2', 'globex', 'Globex', 1, ?)")
      .bind(new Date().toISOString())
      .run();
    const { deps, conversations } = fakeDeps({ services: claimingServices(), replies: [call("finish", { summary: "nothing new" })] });
    await researchTracked(deps);
    expect(conversations).toHaveLength(1);
    expect(conversations[0][0].parts[0].text).toContain("Acme");
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
