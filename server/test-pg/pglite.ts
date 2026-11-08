import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Env } from "../src/env";
import { withDatabase } from "../src/db";
import { type Executor, postgresDatabase } from "../src/db/postgres";
import type { Row } from "../src/db/types";

// applied in order, exactly like Supabase applies its migrations folder
const SCHEMA = ["2026110801_raven_schema.sql", "2026110802_raven_features.sql", "2026110803_user_postings.sql", "2026110804_voice_overall.sql", "2026110810_voice_draft.sql"].map((name) =>
  fileURLToPath(new URL(`../../supabase/migrations/${name}`, import.meta.url)),
);

// same number handling as the postgres.js executor: int8 and numeric come back as numbers, like D1
const PARSERS = { 20: Number, 1700: Number };

export function pgliteExecutor(pg: PGlite): Executor {
  const run = async (q: Pick<PGlite, "query">, sql: string, params: unknown[]) => {
    const result = await q.query<Row>(sql, params);
    return { rows: result.rows, changes: result.affectedRows ?? 0 };
  };
  return {
    query: (sql, params) => run(pg, sql, params),
    transaction: (fn) => pg.transaction((tx) => fn({ query: (sql, params) => run(tx, sql, params) })),
    close: () => pg.close(),
  };
}

/** An in-memory Postgres with the real Supabase schema applied, wrapped in our D1-shaped Database. */
export async function openTestDatabase() {
  const pg = new PGlite({ extensions: { vector }, parsers: PARSERS });
  // Supabase has these roles; PGlite does not, and the schema revokes from them
  await pg.exec("CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;");
  for (const file of SCHEMA) await pg.exec(readFileSync(file, "utf8"));
  const database = postgresDatabase(pgliteExecutor(pg));
  const env = withDatabase({ MEMORY_SECRET: "test-memory-secret", SESSION_SECRET: "test-secret" } as Env, database);
  return { pg, database, env };
}

export async function tableNames(pg: PGlite) {
  const { rows } = await pg.query<{ name: string }>("SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public' ORDER BY 1");
  return rows.map((r) => r.name);
}
