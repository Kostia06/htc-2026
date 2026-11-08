import { Hono } from "hono";
import { agentDirectory } from "./a2a/agent-directory";
import { a2aRouter } from "./a2a/router";
import { researchTracked } from "./agents/background";
import { liveDeps } from "./agents/live";
import { admin } from "./api/admin";
import { agent } from "./api/agent";
import { companies } from "./api/companies";
import { connections } from "./api/connections";
import { crossroads } from "./api/crossroads";
import { experiences } from "./api/experiences";
import { feed } from "./api/feed";
import { headset } from "./api/headset";
import { me } from "./api/me";
import { memories } from "./api/memories";
import { memory } from "./api/memory";
import { notifications } from "./api/notifications";
import { onboarding } from "./api/onboarding";
import { outcome } from "./api/outcome";
import { pairing } from "./api/pairing";
import { postings } from "./api/postings";
import { jobs } from "./api/jobs";
import { voice } from "./api/voice";
import { voiceHistory } from "./api/voice-history";
import { profile } from "./api/profile";
import { recap } from "./api/recap";
import { replay } from "./api/replay";
import { research } from "./api/research";
import { resume } from "./api/resume";
import { tailored } from "./api/resume-tailored";
import { roadmap } from "./api/roadmap";
import { session } from "./api/session";
import { updates } from "./api/updates";
import { requireSession } from "./auth/session";
import { scopeDb } from "./db";
import type { AppContext, Env } from "./env";
import { rebuildStaleFeeds } from "./feed/build";
import { corsForApi } from "./lib/cors";
import { collectGarbage } from "./memory/gc";
import { runNotificationCron } from "./notifications/generate";

const app = new Hono<AppContext>();

// first of all: on Postgres every handler in this request shares one database client (a no-op on D1)
app.use("*", async (c, next) => {
  c.env = scopeDb(c.env);
  await next();
});

// before the session check, so preflights are answered without a token
app.use("/api/*", corsForApi);
app.use("/api/*", async (c, next) => {
  // pairing checks its own session: the headset claiming a code has none yet, and one refreshing may hold an expired one
  if (c.req.path === "/api/session" || c.req.path.startsWith("/api/pairing") || c.req.path === "/api/headset/refresh") return next();
  return requireSession(c, next);
});

app.route("/api/session", session);
app.route("/api/experiences", experiences);
app.route("/api/memory", memory);
app.route("/api/research", research);
app.route("/api/me/memories", memories);
app.route("/api/me/profile", profile);
app.route("/api/me/outcome", outcome);
app.route("/api/connections", connections);
app.route("/api/me", me);
app.route("/api/onboarding", onboarding);
app.route("/api/pairing", pairing);
app.route("/api/headset", headset);
app.route("/api/voice", voice);
app.route("/api/voice/history", voiceHistory);
app.route("/api/voice/sessions", replay);
app.route("/api/companies", companies);
app.route("/api/agent", agent);
app.route("/api/feed", feed);
app.route("/api/roadmap", roadmap);
app.route("/api/resume/tailored", tailored);
app.route("/api/resume", resume);
app.route("/api/recap", recap);
app.route("/api/updates", updates);
app.route("/api/crossroads", crossroads);
app.route("/api/postings", postings);
app.route("/api/jobs", jobs);
app.route("/api/notifications", notifications);
// outside the /api CORS and session middleware: the card is public, /a2a checks its own session, /admin its secret
app.route("/admin", admin);
app.route("/", a2aRouter((env, waitUntil) => agentDirectory(liveDeps(env, waitUntil))));

export default {
  fetch: app.fetch,
  request: app.request,
  scheduled: async (_event, rawEnv, ctx) => {
    const env = scopeDb(rawEnv);
    ctx.waitUntil(collectGarbage(env));
    // after the feed rebuild, so new top matches are there to be noticed
    ctx.waitUntil(rebuildStaleFeeds(env).finally(() => runNotificationCron(env)));
    ctx.waitUntil(researchTracked(liveDeps(env, (work) => ctx.waitUntil(work))));
  },
} satisfies ExportedHandler<Env> & { request: typeof app.request };
