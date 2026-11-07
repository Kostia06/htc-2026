import { Hono } from "hono";
import { research, researchTracked } from "./agent/research";
import type { AppContext, Env } from "./env";
import { sha256 } from "./lib/hash";
import { experiences } from "./memory/experiences";
import { memory } from "./memory/insights";
import { issueSession, requireSession } from "./session";

const MINTS_PER_HOUR = 10;

const app = new Hono<AppContext>();

app.post("/api/session", async (c) => {
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

app.use("/api/*", async (c, next) => {
  if (c.req.path === "/api/session") return next();
  return requireSession(c, next);
});

app.route("/api/experiences", experiences);
app.route("/api/memory", memory);
app.route("/api/research", research);

export default {
  fetch: app.fetch,
  request: app.request,
  scheduled: async (_event, env, ctx) => {
    ctx.waitUntil(researchTracked(env));
  },
} satisfies ExportedHandler<Env> & { request: typeof app.request };
