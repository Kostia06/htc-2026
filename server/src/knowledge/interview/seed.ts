// Turns the curated company questions into idempotent statements that run the same on D1 and Postgres.
// Every row is is_seeded = 1 with no contributor, so it shows as an example and never counts toward the
// three-people rule. Imports only types, so scripts/seed-knowledge.mjs can load it straight into Node.
import type { CompanyQuestionSet } from "./types";

export type SeedStatement = { sql: string; params: (string | number)[] };
type Company = { slug: string; name: string; website: string };

// fixed, so reruns write the same rows
const SEEDED_AT = "2026-11-08T00:00:00.000Z";
export const EXAMPLE_ID_PREFIX = "ex_q_";

// the demo companies the apps show besides the Crossroads employers (the script adds those too, so either seed can run
// first); an existing row is left exactly as it is
export const demoCompanies: Company[] = [
  { slug: "atb", name: "ATB Financial", website: "https://www.atb.com" },
  { slug: "benevity", name: "Benevity", website: "https://benevity.com" },
  { slug: "neo-financial", name: "Neo Financial", website: "https://www.neofinancial.com" },
  { slug: "helcim", name: "Helcim", website: "https://www.helcim.com" },
];

// one row per question, id by slug and position: append new questions at the end of a set to keep ids stable
export function exampleRows(sets: CompanyQuestionSet[]) {
  return sets.flatMap((set) =>
    set.slugs.flatMap((slug) => set.questions.map((q, i) => ({ id: `${EXAMPLE_ID_PREFIX}${slug}_${i + 1}`, slug, role: set.role, ...q }))),
  );
}

export function knowledgeStatements(sets: CompanyQuestionSet[], companies: Company[] = demoCompanies): SeedStatement[] {
  const rows = exampleRows(sets);
  const companyRows = companies.map((c) => ({
    sql: "INSERT INTO companies (id, slug, name, website, tracked) VALUES (?, ?, ?, ?, 0) ON CONFLICT (slug) DO NOTHING",
    params: [`co_${c.slug}`, c.slug, c.name, c.website],
  }));
  // a company that doesn't exist yet simply gets no rows; WHERE keeps SQLite from reading ON CONFLICT as a join
  const questionRows = rows.map((r) => ({
    sql: `INSERT INTO experiences (id, company_id, role, questions_json, format, tips, is_seeded, created_at, contributor)
          SELECT ?, id, ?, ?, ?, ?, 1, ?, NULL FROM companies WHERE slug = ?
          ON CONFLICT (id) DO UPDATE SET role = excluded.role, questions_json = excluded.questions_json, format = excluded.format, tips = excluded.tips`,
    params: [r.id, r.role, JSON.stringify([r.text]), r.round, r.shows, SEEDED_AT, r.slug],
  }));
  // examples dropped from the data leave the database too; real reports never match is_seeded = 1.
  // The ids are inlined, not bound: D1 caps a statement at 100 parameters, and they are built from slugs and numbers only
  const keep = rows.map((r) => `'${r.id.replaceAll("'", "''")}'`).join(", ");
  const prune = {
    sql: `DELETE FROM experiences WHERE is_seeded = 1 AND substr(id, 1, ${EXAMPLE_ID_PREFIX.length}) = '${EXAMPLE_ID_PREFIX}' AND id NOT IN (${keep})`,
    params: [],
  };
  return [...companyRows, ...questionRows, prune];
}
