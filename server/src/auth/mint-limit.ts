import type { Context } from "hono";
import type { AppContext } from "../env";
import { sha256 } from "../lib/hash";

const MINTS_PER_HOUR = 10;

// anything that hands out credentials without a sign-in is limited per network; the IP is only ever stored hashed
export async function claimMintSlot(c: Context<AppContext>, scope: "session" | "pairing") {
  const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
  const ipHash = await sha256(`${c.env.SESSION_SECRET}:${scope}:${ip}`);
  const since = new Date(Date.now() - 3600_000).toISOString();
  const recent = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM session_mints WHERE ip_hash = ? AND created_at > ?")
    .bind(ipHash, since)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= MINTS_PER_HOUR) return false;
  await c.env.DB.prepare("INSERT INTO session_mints (ip_hash, created_at) VALUES (?, ?)").bind(ipHash, new Date().toISOString()).run();
  return true;
}
