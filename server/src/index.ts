import { Hono } from "hono";
import { researchTracked } from "./agents/background";
import { liveDeps } from "./agents/live";
import { agent } from "./api/agent";
import { experiences } from "./api/experiences";
import { memories } from "./api/memories";
import { memory } from "./api/memory";
import { profile } from "./api/profile";
import { research } from "./api/research";
import { session } from "./api/session";
import { requireSession } from "./auth/session";
import type { AppContext, Env } from "./env";
import { collectGarbage } from "./memory/gc";

const app = new Hono<AppContext>();

app.use("/api/*", async (c, next) => {
  if (c.req.path === "/api/session") return next();
  return requireSession(c, next);
});

app.route("/api/session", session);
app.route("/api/experiences", experiences);
app.route("/api/memory", memory);
app.route("/api/research", research);
app.route("/api/me/memories", memories);
app.route("/api/me/profile", profile);
app.route("/api/agent", agent);

export default {
  fetch: app.fetch,
  request: app.request,
  scheduled: async (_event, env, ctx) => {
    ctx.waitUntil(collectGarbage(env));
    ctx.waitUntil(researchTracked(liveDeps(env, (work) => ctx.waitUntil(work))));
  },
} satisfies ExportedHandler<Env> & { request: typeof app.request };
