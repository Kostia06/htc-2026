#!/usr/bin/env node
// Seeds curated example interview questions for the Calgary employers and demo companies into experiences.
// Every row is flagged is_seeded = 1 with no contributor: shown as an example, never counted toward the three-people rule.
// Idempotent: rerunning updates the examples in place, prunes dropped ones, and never touches real reports.
// Field question banks and resume guidance live in src/knowledge and ship with the code; they need no seeding.
//
//   SUPABASE_DB_URL='postgres://…' node scripts/seed-knowledge.mjs --postgres     # Supabase (production)
//   node scripts/seed-knowledge.mjs --d1-local                                   # local wrangler D1
//   node scripts/seed-knowledge.mjs --dry-run                                    # count only, writes nothing
//
// The connection string is never printed.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { translate } from "../src/db/translate.ts";
import { calgaryEmployers } from "../src/crossroads/seed/roads.ts";
import { businessCompanyQuestions } from "../src/knowledge/interview/companies-business.ts";
import { peopleCompanyQuestions } from "../src/knowledge/interview/companies-people.ts";
import { techCompanyQuestions } from "../src/knowledge/interview/companies-tech.ts";
import { demoCompanies, exampleRows, knowledgeStatements } from "../src/knowledge/interview/seed.ts";

const SERVER_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const flag = (name) => process.argv.slice(2).includes(`--${name}`);

const sets = [...techCompanyQuestions, ...businessCompanyQuestions, ...peopleCompanyQuestions];
const statements = knowledgeStatements(sets, [...calgaryEmployers, ...demoCompanies]);
const summary = `${exampleRows(sets).length} example questions across ${new Set(sets.flatMap((s) => s.slugs)).size} companies`;

async function seedPostgres() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) throw new Error("set SUPABASE_DB_URL to the Supabase Postgres connection string");
  const sql = postgres(url, { max: 1, prepare: false });
  try {
    await sql.begin(async (tx) => {
      for (const s of statements) await tx.unsafe(translate(s.sql), s.params);
    });
  } finally {
    await sql.end();
  }
}

// wrangler d1 execute takes no bound parameters, so values are inlined as SQL literals
const literal = (v) => (typeof v === "number" ? String(v) : `'${String(v).replaceAll("'", "''")}'`);
function seedD1Local() {
  const inline = statements.map((s) => {
    let i = 0;
    return `${s.sql.replace(/\?/g, () => literal(s.params[i++]))};`;
  });
  const dir = mkdtempSync(join(tmpdir(), "seed-knowledge-"));
  try {
    const file = join(dir, "seed.sql");
    writeFileSync(file, inline.join("\n"));
    execFileSync("pnpm", ["exec", "wrangler", "d1", "execute", "htc_mentor", "--local", "--file", file], { cwd: SERVER_DIR, stdio: "inherit" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (flag("postgres")) {
  await seedPostgres();
  console.log(`seeded ${summary} into Postgres`);
} else if (flag("d1-local")) {
  seedD1Local();
  console.log(`seeded ${summary} into local D1`);
} else if (flag("dry-run")) {
  console.log(`would seed ${summary} (${statements.length} statements)`);
} else {
  console.error("pass --postgres, --d1-local or --dry-run");
  process.exit(2);
}
