import { Hono } from "hono";
import type { AppContext, Env } from "./env";
import { issueSession, requireSession } from "./session";

const app = new Hono<AppContext>();

app.post("/api/session", async (c) => c.json({ token: await issueSession(c.env.SESSION_SECRET) }));

app.use("/api/*", async (c, next) => {
  if (c.req.path === "/api/session") return next();
  return requireSession(c, next);
});

export default {
  fetch: app.fetch,
  request: app.request,
} satisfies ExportedHandler<Env> & { request: typeof app.request };
