import { Hono } from "hono";
import { research, researchTracked } from "./agent/research";
import type { AppContext, Env } from "./env";
import { experiences } from "./memory/experiences";
import { memory } from "./memory/insights";
import { issueSession, requireSession } from "./session";

const app = new Hono<AppContext>();

app.post("/api/session", async (c) => c.json({ token: await issueSession(c.env.SESSION_SECRET) }));

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
