import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { companies } from "../../src/api/companies";
import { issueSession, requireSession } from "../../src/auth/session";
import type { AppContext } from "../../src/env";

const app = new Hono<AppContext>();
app.use("*", requireSession);
app.route("/", companies);

type Row = { slug: string; name: string; factCount: number; reportedCount: number; lastResearchedAt: string | null };

async function list() {
  const token = await issueSession(env.SESSION_SECRET);
  const res = await app.request("/", { headers: { Authorization: `Bearer ${token}` } }, env);
  return { status: res.status, body: await res.json<{ companies: Row[] }>() };
}

describe("GET /api/companies", () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO companies (id, slug, name, last_researched_at) VALUES ('c1', 'atb', 'ATB Financial', '2026-11-07T08:00:00.000Z')"),
      env.DB.prepare("INSERT INTO companies (id, slug, name, last_researched_at) VALUES ('c2', 'helcim', 'Helcim', NULL)"),
      env.DB.prepare("INSERT INTO companies (id, slug, name, last_researched_at) VALUES ('c3', 'benevity', 'Benevity', '2026-11-07T09:00:00.000Z')"),
      env.DB.prepare(
        "INSERT INTO company_facts (id, company_id, kind, text, source_url, fetched_at, content_hash) VALUES ('f1', 'c1', 'about', 'Bank', 'https://atb.com', '2026-11-07T08:00:00.000Z', 'h1')",
      ),
      env.DB.prepare(
        "INSERT INTO company_facts (id, company_id, kind, text, source_url, fetched_at, content_hash) VALUES ('f2', 'c1', 'tech', 'Uses Java', 'https://atb.com', '2026-11-07T08:00:00.000Z', 'h2')",
      ),
      env.DB.prepare(
        "INSERT INTO experiences (id, company_id, role, questions_json, is_seeded, created_at) VALUES ('e1', 'c1', 'Dev', '[\"Q\"]', 1, '2026-11-01T00:00:00.000Z')",
      ),
      env.DB.prepare(
        "INSERT INTO experiences (id, company_id, role, questions_json, is_seeded, created_at) VALUES ('e2', 'c1', 'Dev', '[\"Q\"]', 0, '2026-11-02T00:00:00.000Z')",
      ),
    ]);
  });

  it("lists every company with counts, freshest research first and unresearched last", async () => {
    const { status, body } = await list();
    expect(status).toBe(200);
    expect(body.companies.map((c) => c.slug)).toEqual(["benevity", "atb", "helcim"]);
    const atb = body.companies.find((c) => c.slug === "atb")!;
    expect(atb).toEqual({ slug: "atb", name: "ATB Financial", factCount: 2, reportedCount: 1, lastResearchedAt: "2026-11-07T08:00:00.000Z" });
    expect(body.companies.find((c) => c.slug === "helcim")).toEqual({ slug: "helcim", name: "Helcim", factCount: 0, reportedCount: 0, lastResearchedAt: null });
  });

  it("rejects requests without a session", async () => {
    expect((await app.request("/", {}, env)).status).toBe(401);
  });
});
