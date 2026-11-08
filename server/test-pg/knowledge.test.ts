// The curated interview examples on Postgres, run the way scripts/seed-knowledge.mjs --postgres runs them.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { calgaryEmployers } from "../src/crossroads/seed/roads";
import { translate } from "../src/db/translate";
import { companyQuestionSets } from "../src/knowledge/interview";
import { demoCompanies, exampleRows, knowledgeStatements } from "../src/knowledge/interview/seed";
import { getCompanyInsights } from "../src/memory/insights";
import { openTestDatabase } from "./pglite";

let db: Awaited<ReturnType<typeof openTestDatabase>>;
const statements = knowledgeStatements(companyQuestionSets, [...calgaryEmployers, ...demoCompanies]);
const seededCount = async () => (await db.pg.query<{ n: number }>("SELECT count(*)::int AS n FROM experiences WHERE is_seeded = 1")).rows[0].n;

beforeAll(async () => {
  db = await openTestDatabase();
});
afterAll(() => db.pg.close());

describe("curated interview examples on Postgres", () => {
  it("seeds idempotently, keeps real reports, and shows only flagged examples", async () => {
    // twice: the seed must be safe to rerun against production
    for (let round = 0; round < 2; round++) await db.pg.transaction(async (tx) => {
      for (const s of statements) await tx.query(translate(s.sql), s.params);
    });
    expect(await seededCount()).toBe(exampleRows(companyQuestionSets).length);

    const { id } = (await db.pg.query<{ id: string }>("SELECT id FROM companies WHERE slug = 'westjet'")).rows[0];
    await db.pg.query("INSERT INTO experiences (id, company_id, role, questions_json, is_seeded, created_at) VALUES ('pg_real', $1, 'dev', '[\"Only me\"]', 0, '2026-11-08')", [id]);
    for (const s of statements) await db.pg.query(translate(s.sql), s.params);
    expect((await db.pg.query("SELECT 1 FROM experiences WHERE id = 'pg_real'")).rows).toHaveLength(1);

    const insights = await getCompanyInsights(db.env, "westjet");
    expect(insights?.reportCount).toBe(1);
    expect(insights?.questions.map((q) => q.text)).not.toContain("Only me");
    expect(insights?.questions.every((q) => q.example && q.round && q.shows)).toBe(true);
  });
});
