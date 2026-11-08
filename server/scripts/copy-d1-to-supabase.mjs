#!/usr/bin/env node
// Copies every table of the live D1 database into Supabase Postgres (schema already applied).
//
//   SUPABASE_DB_URL='postgres://postgres:...@db.<ref>.supabase.co:5432/postgres' node scripts/copy-d1-to-supabase.mjs [--dry-run] [--tables a,b]
//
// Idempotent: rows are inserted with ON CONFLICT DO NOTHING, so running it twice adds nothing. Tables without a
// primary key (submission_log, session_mints) have no conflict target, so they are copied only while empty on the
// Postgres side. Reads go through `wrangler d1 execute --remote --json`, page by page. The connection string is never
// printed. Vectors are not copied (Vectorize cannot export them): afterwards call POST /admin/reembed-vectors, see README.
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const SERVER_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const D1_NAME = "htc_mentor";
const PAGE = 500;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const only = args.find((a) => a.startsWith("--tables="))?.slice("--tables=".length).split(",");

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("set SUPABASE_DB_URL to the Supabase Postgres connection string (direct or session pooler, not transaction pooler)");
  process.exit(2);
}

function d1(sql) {
  const out = execFileSync("pnpm", ["exec", "wrangler", "d1", "execute", D1_NAME, "--remote", "--json", "--command", sql], {
    cwd: SERVER_DIR,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 256 * 1024 * 1024,
  });
  const parsed = JSON.parse(out.slice(out.indexOf("[")));
  return parsed[0].results;
}

// parents before children, so foreign keys hold while inserting
function orderByForeignKeys(tables, edges) {
  const remaining = new Set(tables);
  const ordered = [];
  while (remaining.size) {
    const ready = [...remaining].filter((t) => !edges.some((e) => e.child === t && e.parent !== t && remaining.has(e.parent)));
    if (ready.length === 0) throw new Error(`foreign key cycle among ${[...remaining].join(", ")}`);
    for (const t of ready.sort()) {
      ordered.push(t);
      remaining.delete(t);
    }
  }
  return ordered;
}

// SSL verification can be turned off for the direct connection's self-signed CA with SUPABASE_DB_SSL=no-verify
const sql = postgres(url, { max: 1, prepare: false, ssl: process.env.SUPABASE_DB_SSL === "no-verify" ? { rejectUnauthorized: false } : "require" });

try {
  const d1Tables = d1("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_cf%' ESCAPE '\\' AND name != 'd1_migrations'")
    .map((r) => r.name)
    .filter((name) => !only || only.includes(name));
  const pgTables = new Set((await sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`).map((r) => r.tablename));
  const edges = await sql`
    SELECT tc.table_name AS child, ccu.table_name AS parent
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.constraint_schema = tc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'`;
  const keyed = new Set(
    (await sql`SELECT table_name FROM information_schema.table_constraints WHERE constraint_type = 'PRIMARY KEY' AND table_schema = 'public'`).map((r) => r.table_name),
  );

  const missing = d1Tables.filter((t) => !pgTables.has(t));
  if (missing.length) console.warn(`skipping tables that do not exist in Postgres (apply their migration first): ${missing.join(", ")}`);

  for (const table of orderByForeignKeys(d1Tables.filter((t) => pgTables.has(t)), edges)) {
    if (!keyed.has(table)) {
      const [{ n }] = await sql`SELECT count(*)::int AS n FROM ${sql(table)}`;
      if (n > 0) {
        console.log(`${table}: no primary key and ${n} rows already in Postgres, skipped`);
        continue;
      }
    }
    let read = 0;
    let inserted = 0;
    for (let offset = 0; ; offset += PAGE) {
      const rows = d1(`SELECT * FROM ${table} ORDER BY rowid LIMIT ${PAGE} OFFSET ${offset}`);
      if (rows.length === 0) break;
      read += rows.length;
      if (!dryRun) {
        const columns = Object.keys(rows[0]);
        const result = await sql`INSERT INTO ${sql(table)} ${sql(rows, ...columns)} ON CONFLICT DO NOTHING`;
        inserted += result.count;
      }
      if (rows.length < PAGE) break;
    }
    console.log(`${table}: ${read} rows read${dryRun ? "" : `, ${inserted} inserted`}`);
  }
  console.log("\ndone. Vectors are not copied; run the re-embed route next (README, 'Database: Supabase').");
} finally {
  await sql.end();
}
