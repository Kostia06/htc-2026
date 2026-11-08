#!/usr/bin/env node
// Seeds Crossroads: flagged example lines and trails for every road, plus the real Calgary employers on each road.
// Idempotent: rerunning updates the examples in place and never touches real reports, votes or outcomes.
//
//   SUPABASE_DB_URL='postgres://…' node scripts/seed-crossroads.mjs --postgres     # Supabase (production)
//   node scripts/seed-crossroads.mjs --d1-local                                   # local wrangler D1
//   node scripts/seed-crossroads.mjs --research=https://api.skillit.study [--only=westjet,pason]
//
// --research runs the existing research agent once per employer through POST /api/research/:slug (a fresh anonymous
// session, one company at a time, a 30-minute cooldown per company on the server). Run it after seeding, so the
// employers exist. Every fact it saves keeps its source URL. The connection string is never printed.
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { translate } from "../src/db/translate.ts";
import { businessLines } from "../src/crossroads/seed/lines-business.ts";
import { peopleLines } from "../src/crossroads/seed/lines-people.ts";
import { techLines } from "../src/crossroads/seed/lines-tech.ts";
import { calgaryEmployers, seedTrails } from "../src/crossroads/seed/roads.ts";
import { seedStatements } from "../src/crossroads/seed/statements.ts";

const SERVER_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const value = (name) => flag(name)?.split("=").slice(1).join("=");

const statements = seedStatements([...techLines, ...businessLines, ...peopleLines], seedTrails, calgaryEmployers);

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
  execFileSync("pnpm", ["exec", "wrangler", "d1", "execute", "htc_mentor", "--local", "--command", inline.join("\n")], { cwd: SERVER_DIR, stdio: "inherit" });
}

async function research(base) {
  const only = value("only")?.split(",");
  const employers = calgaryEmployers.filter((e) => !only || only.includes(e.slug));
  const session = await fetch(`${base}/api/session`, { method: "POST" }).then((r) => r.json());
  if (!session.token) throw new Error("could not start a session");
  for (const employer of employers) {
    const res = await fetch(`${base}/api/research/${employer.slug}`, { method: "POST", headers: { Authorization: `Bearer ${session.token}` } });
    const body = await res.json().catch(() => ({}));
    console.log(`${employer.slug}: ${res.status} ${body.status ?? body.error ?? ""} added=${body.added ?? 0}`);
  }
}

if (flag("postgres")) {
  await seedPostgres();
  console.log(`seeded ${statements.length} rows into Postgres`);
} else if (flag("d1-local")) {
  seedD1Local();
} else if (!flag("research")) {
  console.error("pass --postgres, --d1-local or --research=<api base url>");
  process.exit(2);
}
if (flag("research")) await research(value("research").replace(/\/$/, ""));
