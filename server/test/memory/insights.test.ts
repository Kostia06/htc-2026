import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../src/index";
import { getCompanyInsights } from "../../src/memory/insights";
import { issueSession } from "../../src/auth/session";

async function addExperience(i: number, seeded = 0) {
  await env.DB.prepare(
    "INSERT INTO experiences (id, company_id, role, questions_json, format, tips, is_seeded, created_at) VALUES (?, 'c1', 'Junior Developer', ?, 'Video call', 'Practise SQL', ?, ?)",
  ).bind(`e${i}`, JSON.stringify([`Question ${i}`, "Tell me about yourself"]), seeded, new Date().toISOString()).run();
}

async function addReport(id: string, questions: string[], createdAt: string, seeded = 0) {
  await env.DB.prepare(
    "INSERT INTO experiences (id, company_id, role, questions_json, is_seeded, created_at) VALUES (?, 'c1', 'Junior Developer', ?, ?, ?)",
  ).bind(id, JSON.stringify(questions), seeded, createdAt).run();
}

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

describe("company insights", () => {
  beforeEach(async () => {
    await env.DB.prepare("INSERT INTO companies (id, slug, name) VALUES ('c1', 'acme', 'Acme')").run();
    await env.DB.prepare(
      "INSERT INTO company_facts (id, company_id, kind, text, source_url, fetched_at, content_hash) VALUES ('f1', 'c1', 'hiring', 'Hiring juniors', 'https://acme.com/careers', '2026-11-07T00:00:00Z', 'h1')",
    ).run();
  });

  it("hides reported questions until 3 reports exist", async () => {
    await addExperience(1);
    await addExperience(2);
    const two = await getCompanyInsights(env, "acme");
    expect(two?.reportCount).toBe(2);
    expect(two?.questions).toEqual([]);
    expect(two).not.toHaveProperty("tips");
    expect(two?.facts[0].source_url).toBe("https://acme.com/careers");

    await addExperience(3);
    const three = await getCompanyInsights(env, "acme");
    expect(three?.questions.map((q) => q.text)).toContain("Tell me about yourself");
    expect(three?.questions.find((q) => q.text === "Tell me about yourself")?.count).toBe(3);
  });

  it("counts people, not reports: one person's three reports stay hidden", async () => {
    for (const i of [1, 2, 3]) {
      await env.DB.prepare(
        "INSERT INTO experiences (id, company_id, role, questions_json, is_seeded, created_at, contributor) VALUES (?, 'c1', 'Junior Developer', ?, 0, ?, 'same-person')",
      ).bind(`s${i}`, JSON.stringify(["Why us?"]), new Date().toISOString()).run();
    }
    expect((await getCompanyInsights(env, "acme"))?.questions).toEqual([]);
  });

  it("shows seeded example questions, flagged, without counting them as reports", async () => {
    for (const i of [1, 2, 3]) await addExperience(i, 1);
    const out = await getCompanyInsights(env, "acme");
    expect(out?.reportCount).toBe(0);
    expect(out?.questions.length).toBeGreaterThan(0);
    expect(out?.questions.every((q) => q.example)).toBe(true);
  });

  it("does not let seeded rows lift real reports over the threshold", async () => {
    await addExperience(1, 1);
    await addExperience(2, 1);
    await env.DB.prepare(
      "INSERT INTO experiences (id, company_id, role, questions_json, is_seeded, created_at) VALUES ('real', 'c1', 'Junior Developer', ?, 0, ?)",
    ).bind(JSON.stringify(["A very specific question only I was asked"]), new Date().toISOString()).run();
    const out = await getCompanyInsights(env, "acme");
    expect(out?.questions.map((q) => q.text)).not.toContain("A very specific question only I was asked");
  });

  it("ranks a question reported recently above one reported more often long ago", async () => {
    for (const id of ["old1", "old2", "old3"]) await addReport(id, ["Old favourite"], daysAgo(400));
    await addReport("new1", ["Brand new question"], daysAgo(2));
    const out = await getCompanyInsights(env, "acme");
    expect(out?.questions.map((q) => q.text)).toEqual(["Brand new question", "Old favourite"]);
    expect(out?.questions[1].count).toBe(3);
  });

  it("still ranks by count among questions reported around the same time", async () => {
    await addReport("a", ["Common", "Rare"], daysAgo(10));
    await addReport("b", ["Common"], daysAgo(10));
    await addReport("c", ["Common"], daysAgo(10));
    const out = await getCompanyInsights(env, "acme");
    expect(out?.questions.map((q) => q.text)).toEqual(["Common", "Rare"]);
  });

  it("says in which month each real question was last reported, and nothing for examples", async () => {
    await addReport("r1", ["Design a parking lot"], "2026-06-01T00:00:00.000Z");
    await addReport("r2", ["Design a parking lot"], "2026-10-01T00:00:00.000Z");
    await addReport("r3", ["Other"], "2026-09-01T00:00:00.000Z");
    await addReport("s1", ["Why Acme?"], "2026-11-01T00:00:00.000Z", 1);
    const out = await getCompanyInsights(env, "acme");
    const byText = Object.fromEntries((out?.questions ?? []).map((q) => [q.text, q]));
    expect(byText["Design a parking lot"].last_reported_at).toBe("2026-10");
    expect(byText["Why Acme?"]).toMatchObject({ example: true, last_reported_at: null });
    expect(out?.questions.at(-1)?.text).toBe("Why Acme?");
  });

  it("keeps fresh reports hidden while there are fewer than 3", async () => {
    await addReport("n1", ["Fresh one"], daysAgo(1));
    await addReport("n2", ["Fresh one"], daysAgo(1));
    expect((await getCompanyInsights(env, "acme"))?.questions).toEqual([]);
  });

  it("returns null for an unknown company", async () => {
    expect(await getCompanyInsights(env, "nope")).toBeNull();
  });

  it("serves insights over GET /api/memory/:slug", async () => {
    const token = await issueSession(env.SESSION_SECRET);
    const res = await app.request("/api/memory/acme", { headers: { Authorization: `Bearer ${token}` } }, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ facts: unknown[]; reportCount: number }>();
    expect(body.facts).toHaveLength(1);
    expect(JSON.stringify(body)).not.toContain("questions_json");
  });
});
