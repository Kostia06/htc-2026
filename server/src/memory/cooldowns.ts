import { db } from "../db";
import type { Env } from "../env";

// atomic: of two runs racing for the same scope and key, only one gets through
export async function claimCooldown(env: Env, scope: string, key: string, cooldownMs: number, now = new Date()) {
  const cutoff = new Date(now.getTime() - cooldownMs).toISOString();
  const row = await db(env).prepare(
    `INSERT INTO cooldowns (scope, key, last_run_at) VALUES (?1, ?2, ?3)
     ON CONFLICT (scope, key) DO UPDATE SET last_run_at = excluded.last_run_at WHERE cooldowns.last_run_at < ?4
     RETURNING key`,
  )
    .bind(scope, key, now.toISOString(), cutoff)
    .first<{ key: string }>();
  return row !== null;
}
