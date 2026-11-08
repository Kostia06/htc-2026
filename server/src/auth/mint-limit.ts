import { db } from "../db";
import type { Context } from "hono";
import type { AppContext } from "../env";
import { sha256 } from "../lib/hash";

type Scope = "session" | "pairing-claim" | "headset-refresh";
type Limit = { attempts: number; windowMs: number };

const MINTS: Limit = { attempts: 10, windowMs: 3600_000 };

// the IP is only ever stored hashed, salted with the secret and scope so the hashes can't be matched across tables or limits
const ipHashFor = (c: Context<AppContext>, scope: Scope) => sha256(`${c.env.SESSION_SECRET}:${scope}:${c.req.header("CF-Connecting-IP") ?? "unknown"}`);

export async function hasReachedLimit(c: Context<AppContext>, scope: Scope, limit: Limit) {
  const since = new Date(Date.now() - limit.windowMs).toISOString();
  const recent = await db(c.env).prepare("SELECT COUNT(*) AS n FROM session_mints WHERE ip_hash = ? AND created_at > ?")
    .bind(await ipHashFor(c, scope), since)
    .first<{ n: number }>();
  return (recent?.n ?? 0) >= limit.attempts;
}

export async function recordAttempt(c: Context<AppContext>, scope: Scope) {
  await db(c.env).prepare("INSERT INTO session_mints (ip_hash, created_at) VALUES (?, ?)").bind(await ipHashFor(c, scope), new Date().toISOString()).run();
}

// anything that hands out credentials without a sign-in is limited per network
export async function claimMintSlot(c: Context<AppContext>, scope: Scope) {
  if (await hasReachedLimit(c, scope, MINTS)) return false;
  await recordAttempt(c, scope);
  return true;
}
