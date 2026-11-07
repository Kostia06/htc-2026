import type { Env } from "../env";

// atomic, like claimResearch: the row only moves forward once the delay has passed, so racing fetches can't both win
export async function claimFetchSlot(env: Env, host: string, delaySeconds: number, now = new Date()) {
  if (delaySeconds <= 0) return true;
  const cutoff = new Date(now.getTime() - delaySeconds * 1000).toISOString();
  const row = await env.DB.prepare(
    `INSERT INTO host_fetches (host, last_fetched_at) VALUES (?1, ?2)
     ON CONFLICT (host) DO UPDATE SET last_fetched_at = excluded.last_fetched_at WHERE host_fetches.last_fetched_at <= ?3
     RETURNING host`,
  )
    .bind(host, now.toISOString(), cutoff)
    .first<{ host: string }>();
  return row !== null;
}
