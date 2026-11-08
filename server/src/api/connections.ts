import { Hono, type Context } from "hono";
import type { AgentDeps } from "../agents/core/types";
import { liveDeps } from "../agents/live";
import { disconnectGithub, githubStatus, startGithubConnect } from "../connections/github/connection";
import { importGithub, NotConnected } from "../connections/github/import";
import type { AppContext, Env } from "../env";
import { ComposioError, ComposioNotConfigured, composioConfigured } from "../integrations/composio";

type MakeDeps = (env: Env, waitUntil: (work: Promise<unknown>) => void) => AgentDeps;

const IMPORT_COOLDOWN_MS = 10 * 60 * 1000;
const NOT_CONFIGURED = { error: "GitHub isn't set up on this server yet", configured: false };

// an outage or a missing setting at Composio is a clean answer, never a stack trace or anything Composio sent back
function composioFailure(c: Context<AppContext>, e: unknown) {
  if (e instanceof ComposioNotConfigured) return c.json(NOT_CONFIGURED, 503);
  if (e instanceof ComposioError) return c.json({ error: "GitHub couldn't be reached just now, try again" }, 502);
  throw e;
}

// every route acts on the signed-in person only: there is no way to name another account
export function connectionsRouter(makeDeps: MakeDeps) {
  const router = new Hono<AppContext>();
  const depsOf = (c: Context<AppContext>) => makeDeps(c.env, (work) => c.executionCtx.waitUntil(work));

  router.get("/", async (c) => {
    try {
      const { view, justConnected } = await githubStatus(c.env, c.var.sessionId);
      // the first look after the person finished on GitHub starts the import; the app polls this route to see it land
      if (justConnected) c.executionCtx.waitUntil(importGithub(depsOf(c), c.var.sessionId).catch((e) => console.error("github import failed", (e as Error).message)));
      return c.json({ github: { ...view, importing: justConnected } });
    } catch (e) {
      return composioFailure(c, e);
    }
  });

  // answers with the hosted GitHub sign-in to open; returnTo must be the app's scheme or one of our web origins
  router.post("/github", async (c) => {
    if (!composioConfigured(c.env)) return c.json(NOT_CONFIGURED, 503);
    const body = await c.req.json<{ returnTo?: unknown }>().catch(() => ({}) as { returnTo?: unknown });
    const { view } = await githubStatus(c.env, c.var.sessionId).catch(() => ({ view: null }));
    if (view?.status === "connected") return c.json({ error: "GitHub is already connected" }, 409);
    try {
      return c.json(await startGithubConnect(c.env, c.var.sessionId, body.returnTo));
    } catch (e) {
      return composioFailure(c, e);
    }
  });

  router.post("/github/import", async (c) => {
    const deps = depsOf(c);
    if (!(await deps.services.claimCooldown("github-import", c.var.sessionId, IMPORT_COOLDOWN_MS))) {
      return c.json({ error: "GitHub was imported a moment ago, try again in a few minutes" }, 429);
    }
    try {
      await importGithub(deps, c.var.sessionId);
      return c.json({ github: (await githubStatus(c.env, c.var.sessionId)).view });
    } catch (e) {
      if (e instanceof NotConnected) return c.json({ error: e.message }, 409);
      return composioFailure(c, e);
    }
  });

  router.delete("/github", async (c) => {
    try {
      await disconnectGithub(c.env, c.var.sessionId);
      return c.json({ github: (await githubStatus(c.env, c.var.sessionId)).view });
    } catch (e) {
      return composioFailure(c, e);
    }
  });

  return router;
}

export const connections = connectionsRouter(liveDeps);
