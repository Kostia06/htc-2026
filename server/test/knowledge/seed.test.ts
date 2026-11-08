import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { companyQuestionSets, FIELDS, fieldQuestions } from "../../src/knowledge/interview";
import { demoCompanies, exampleRows, knowledgeStatements } from "../../src/knowledge/interview/seed";
import { calgaryEmployers } from "../../src/crossroads/seed/roads";
import { getCompanyInsights } from "../../src/memory/insights";

const companies = [...calgaryEmployers, ...demoCompanies];
const seed = async (sets = companyQuestionSets) => {
  for (const s of knowledgeStatements(sets, companies)) await env.DB.prepare(s.sql).bind(...s.params).run();
};
const count = async (where: string) => (await env.DB.prepare(`SELECT count(*) AS n FROM experiences WHERE ${where}`).first<{ n: number }>())!.n;

describe("curated interview knowledge", () => {
  it("covers every field and all fifteen seeded companies with enough questions", () => {
    for (const field of FIELDS) expect(fieldQuestions[field].length).toBeGreaterThanOrEqual(15);
    const slugs = new Set(companyQuestionSets.flatMap((s) => s.slugs));
    for (const c of companies) expect(slugs).toContain(c.slug);
    for (const set of companyQuestionSets) expect(set.questions.length).toBeGreaterThanOrEqual(12);
    expect(new Set(exampleRows(companyQuestionSets).map((r) => r.id)).size).toBe(exampleRows(companyQuestionSets).length);
  });

  it("seeds flagged examples idempotently, never touching real reports", async () => {
    await seed();
    const westjet = await env.DB.prepare("SELECT id FROM companies WHERE slug = 'westjet'").first<{ id: string }>();
    await env.DB.prepare("INSERT INTO experiences (id, company_id, role, questions_json, is_seeded, created_at) VALUES ('real1', ?, 'dev', '[\"Real one\"]', 0, ?)")
      .bind(westjet!.id, new Date().toISOString())
      .run();
    const seeded = await count("is_seeded = 1");
    expect(seeded).toBe(exampleRows(companyQuestionSets).length);

    await seed();
    expect(await count("is_seeded = 1")).toBe(seeded);
    expect(await count("id = 'real1' AND is_seeded = 0")).toBe(1);
    expect(await count("is_seeded = 1 AND contributor IS NOT NULL")).toBe(0);

    // a question dropped from the data is pruned on the next run
    const trimmed = companyQuestionSets.map((s, i) => (i === 0 ? { ...s, questions: s.questions.slice(1) } : s));
    await seed(trimmed);
    expect(await count("is_seeded = 1")).toBe(exampleRows(trimmed).length);
    expect(await count("id = 'real1'")).toBe(1);
  });

  it("shows the examples as examples, with no report count and the one real report still hidden", async () => {
    await seed();
    const insights = await getCompanyInsights(env, "alberta-health-services");
    expect(insights?.reportCount).toBe(0);
    expect(insights?.questions.length).toBeGreaterThanOrEqual(12);
    expect(insights?.questions.every((q) => q.example && q.round && q.shows && q.last_reported_at === null)).toBe(true);
  });

  it("leaves an existing company row exactly as it was", async () => {
    await env.DB.prepare("INSERT INTO companies (id, slug, name, website, tracked) VALUES ('mine', 'benevity', 'Benevity Inc', NULL, 1)").run();
    await seed();
    expect(await env.DB.prepare("SELECT id, name, tracked FROM companies WHERE slug = 'benevity'").first()).toEqual({ id: "mine", name: "Benevity Inc", tracked: 1 });
    expect(await count("company_id = 'mine'")).toBeGreaterThan(0);
  });
});
