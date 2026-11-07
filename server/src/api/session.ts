import { Hono } from "hono";
import { issueSession } from "../auth/session";
import type { AppContext } from "../env";
import { sha256 } from "../lib/hash";

const MINTS_PER_HOUR = 10;

export const session = new Hono<AppContext>();

session.post("/", async (c) => {
  // hashed so we never keep raw IP addresses
  const ipHash = await sha256(`${c.env.SESSION_SECRET}:${c.req.header("CF-Connecting-IP") ?? "unknown"}`);
  const since = new Date(Date.now() - 3600_000).toISOString();
  const recent = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM session_mints WHERE ip_hash = ? AND created_at > ?")
    .bind(ipHash, since)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= MINTS_PER_HOUR) return c.json({ error: "too many new sessions, try again later" }, 429);
  await c.env.DB.prepare("INSERT INTO session_mints (ip_hash, created_at) VALUES (?, ?)").bind(ipHash, new Date().toISOString()).run();
  return c.json({ token: await issueSession(c.env.SESSION_SECRET) });
});
