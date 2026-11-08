import type { Env } from "../env";
import { d1Database } from "./d1";
import { postgresDatabase, postgresJsExecutor } from "./postgres";
import type { Database } from "./types";

export type { Database, DbResult, Row, Statement } from "./types";

export type Backend = "d1" | "postgres";

// DB_BACKEND is the one switch: "postgres" cuts over, "d1" (the default) rolls back
export function backend(env: Env): Backend {
  const value = env.DB_BACKEND ?? "d1";
  if (value !== "d1" && value !== "postgres") throw new Error(`DB_BACKEND must be "d1" or "postgres", got "${value}"`);
  return value;
}

const SCOPE = Symbol.for("raven.db.scope");
type Scoped = { [SCOPE]?: Database };

function connectionString(env: Env) {
  const value = env.HYPERDRIVE?.connectionString ?? env.SUPABASE_DB_URL;
  if (!value) throw new Error("DB_BACKEND=postgres needs a HYPERDRIVE binding (or SUPABASE_DB_URL for local dev)");
  return value;
}

/** The database behind this env. Store code calls this instead of touching env.DB. */
export function db(env: Env): Database {
  if (backend(env) === "d1") return d1Database(env.DB);
  // outside a scope (no middleware ran) each call opens its own client; fine for one-off work, wasteful in a request
  return (env as Env & Scoped)[SCOPE] ?? postgresDatabase(postgresJsExecutor(connectionString(env)));
}

/**
 * One Postgres client for a whole request or cron run. Nothing is cached on the shared env because Workers must not
 * reuse sockets across requests; the client is not closed explicitly either, since agent runs keep querying after the
 * response (waitUntil) and the runtime drops the sockets with the request context. On D1 this returns env unchanged.
 */
export function scopeDb(env: Env): Env {
  if (backend(env) !== "postgres") return env;
  return { ...env, [SCOPE]: postgresDatabase(postgresJsExecutor(connectionString(env))) } as Env;
}

/** An env whose db() is the given Database, whatever the bindings say; tests use it to run store code on PGlite. */
export function withDatabase(env: Env, database: Database): Env {
  return { ...env, DB_BACKEND: "postgres", [SCOPE]: database } as Env;
}
