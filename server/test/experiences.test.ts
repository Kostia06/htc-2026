import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";

import app from "../src/index";
import { deps } from "../src/memory/experiences";
import { issueSession } from "../src/session";

const body = {
  companySlug: "acme",
  role: "Junior Developer",
  questions: ["Tell me about yourself", "Email me at me@x.com after"],
  format: "Video call, 45 min",
  outcome: "Offer",
  tips: "Kostia says practise SQL",
  authorName: "Kostia",
};

async function post(token: string, payload: unknown = body) {
  return app.request(
    "/api/experiences",
    { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) },
    env,
  );
}

describe("POST /api/experiences", () => {
  beforeEach(async () => {
    vi.spyOn(deps, "scrubNames").mockImplementation(async (_env, fields) => fields);
    vi.spyOn(deps, "upsertVector").mockResolvedValue();
    await env.DB.prepare("INSERT OR IGNORE INTO companies (id, slug, name) VALUES ('c1', 'acme', 'Acme')").run();
  });

  it("stores an anonymized experience", async () => {
    const res = await post(await issueSession(env.SESSION_SECRET));
    expect(res.status).toBe(201);
    const row = await env.DB.prepare("SELECT questions_json, tips, is_seeded FROM experiences").first<{ questions_json: string; tips: string; is_seeded: number }>();
    expect(row?.questions_json).not.toContain("me@x.com");
    expect(row?.tips).toBe("[name] says practise SQL");
    expect(row?.is_seeded).toBe(0);
  });

  it("returns 404 for an unknown company", async () => {
    const res = await post(await issueSession(env.SESSION_SECRET), { ...body, companySlug: "nope" });
    expect(res.status).toBe(404);
  });

  it("rejects a submission with no questions", async () => {
    const res = await post(await issueSession(env.SESSION_SECRET), { ...body, questions: [] });
    expect(res.status).toBe(400);
  });

  it("limits a session to 5 submissions per hour", async () => {
    const token = await issueSession(env.SESSION_SECRET);
    for (let i = 0; i < 5; i++) expect((await post(token)).status).toBe(201);
    expect((await post(token)).status).toBe(429);
  });

  it("anonymizes the role too", async () => {
    await post(await issueSession(env.SESSION_SECRET), { ...body, role: "Kostia's team lead" });
    const row = await env.DB.prepare("SELECT role FROM experiences").first<{ role: string }>();
    expect(row?.role).toBe("[name]'s team lead");
  });

  it("returns 400 instead of crashing on malformed input", async () => {
    const token = await issueSession(env.SESSION_SECRET);
    expect((await post(token, { ...body, questions: "not a list" })).status).toBe(400);
    expect((await post(token, { ...body, role: 42 })).status).toBe(400);
    expect((await post(token, { ...body, questions: Array(30).fill("q") })).status).toBe(400);
  });
});
