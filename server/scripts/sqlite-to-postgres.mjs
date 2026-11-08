#!/usr/bin/env node
// Translates D1 (SQLite) migration files to Postgres, using the same translator the Worker runs queries through.
//
//   node scripts/sqlite-to-postgres.mjs migrations/0019_x.sql [more.sql ...] [--no-rls] > out.sql
//
// Every CREATE TABLE gets ROW LEVEL SECURITY enabled with no policies and public roles revoked, so the publishable key
// cannot read the table through PostgREST. Pass --no-rls to skip that (not for Supabase).
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { translateMigration } from "../src/db/translate.ts";

const args = process.argv.slice(2);
const rls = !args.includes("--no-rls");
const files = args.filter((a) => !a.startsWith("--"));
if (files.length === 0) {
  console.error("usage: node scripts/sqlite-to-postgres.mjs <migration.sql> [...] [--no-rls]");
  process.exit(2);
}

let out = "";
for (const file of files) {
  out += `-- from ${basename(file)}\n`;
  try {
    out += translateMigration(readFileSync(file, "utf8"), { rls });
  } catch (e) {
    console.error(`${file}: ${e.message}`);
    process.exit(1);
  }
  out += "\n";
}
process.stdout.write(out);
