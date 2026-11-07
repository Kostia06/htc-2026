import { Hono } from "hono";
import { agentDirectory } from "./a2a/agent-directory";
import { a2aRouter } from "./a2a/router";
import { researchTracked } from "./agents/background";
import { liveDeps } from "./agents/live";
import { agent } from "./api/agent";
import { experiences } from "./api/experiences";
import { memories } from "./api/memories";
import { memory } from "./api/memory";
import { onboarding } from "./api/onboarding";
import { pairing } from "./api/pairing";
import { voice } from "./api/voice";
import { profile } from "./api/profile";
import { research } from "./api/research";
import { session } from "./api/session";
import { requireSession } from "./auth/session";
import type { AppContext, Env } from "./env";
import { corsForApi } from "./lib/cors";
import { collectGarbage } from "./memory/gc";

const app = new Hono<AppContext>();

// before the session check, so preflights are answered without a token
app.use("/api/*", corsForApi);
app.use("/api/*", async (c, next) => {
  // pairing checks its own session: the headset asking for a code has none yet
  if (c.req.path === "/api/session" || c.req.path.startsWith("/api/pairing")) return next();
  return requireSession(c, next);
});

app.route("/api/session", session);
app.route("/api/experiences", experiences);
app.route("/api/memory", memory);
app.route("/api/research", research);
app.route("/api/me/memories", memories);
app.route("/api/me/profile", profile);
app.route("/api/onboarding", onboarding);
app.route("/api/pairing", pairing);
app.route("/api/voice", voice);
app.route("/api/agent", agent);
// outside the /api CORS and session middleware: the card is public and /a2a checks its own session
app.route("/", a2aRouter((env, waitUntil) => agentDirectory(liveDeps(env, waitUntil))));

export default {
  fetch: app.fetch,
  request: app.request,
  scheduled: async (_event, env, ctx) => {
    ctx.waitUntil(collectGarbage(env));
    ctx.waitUntil(researchTracked(liveDeps(env, (work) => ctx.waitUntil(work))));
  },
} satisfies ExportedHandler<Env> & { request: typeof app.request };
