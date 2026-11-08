import { Hono, type Context } from "hono";
import type { AgentDeps } from "../agents/core/types";
import { liveDeps } from "../agents/live";
import { AppNotConnectable, appViewFor, connectApp, disconnectAppSlug, isCurated, listApps, searchCatalog, validAppSlug } from "../connections/apps";
import { disconnect, isConfigured, listConnections, startConnect, viewFor } from "../connections/connection";
import { importConnection, NotConnected } from "../connections/import";
import { connectorFor } from "../connections/registry";
import type { Connector } from "../connections/types";
import type { AppContext, Env } from "../env";
import { ComposioError, composioConfigured, ComposioNotConfigured } from "../integrations/composio";

type MakeDeps = (env: Env, waitUntil: (work: Promise<unknown>) => void) => AgentDeps;

const IMPORT_COOLDOWN_MS = 10 * 60 * 1000;
const notConfigured = (connector: Connector) => ({ error: `${connector.name} isn't set up on this server yet`, configured: false });

// an outage or a missing setting at Composio is a clean answer, never a stack trace or anything Composio sent back
function composioFailure(c: Context<AppContext>, connector: Connector, e: unknown) {
  if (e instanceof ComposioNotConfigured) return c.json(notConfigured(connector), 503);
  if (e instanceof ComposioError) return c.json({ error: `${connector.name} couldn't be reached just now, try again` }, 502);
  throw e;
}

// every route acts on the signed-in person only: there is no way to name another account
export function connectionsRouter(makeDeps: MakeDeps) {
  const router = new Hono<AppContext>();
  const depsOf = (c: Context<AppContext>) => makeDeps(c.env, (work) => c.executionCtx.waitUntil(work));

  // every provider, configured or not. `github` repeats GitHub's entry for app builds that only know that one
  router.get("/", async (c) => {
    try {
      const { views, justConnected } = await listConnections(c.env, c.var.sessionId);
      // the first look after the person finished signing in starts that import; the app polls this route to see it land
      for (const connector of justConnected) {
        c.executionCtx.waitUntil(importConnection(depsOf(c), c.var.sessionId, connector).catch((e) => console.error(`${connector.id} import failed`, (e as Error).message)));
      }
      // a hiccup checking the other apps must not hide the curated rows
      const apps = await listApps(c.env, c.var.sessionId).catch((e) => {
        console.error("connected apps check failed", (e as Error).message);
        return [];
      });
      return c.json({ connections: views, apps, github: views.find((v) => v.id === "github") });
    } catch (e) {
      if (e instanceof ComposioError) return c.json({ error: "Your connected accounts couldn't be checked just now, try again" }, 502);
      throw e;
    }
  });

  // Composio's whole app catalog, for the search box. Registered before the /:provider guard below, which only knows connectors
  router.get("/catalog", async (c) => {
    if (!composioConfigured(c.env)) return c.json({ apps: [], configured: false });
    try {
      return c.json({ apps: await searchCatalog(c.env, c.req.query("q") ?? ""), configured: true });
    } catch (e) {
      if (e instanceof ComposioError) return c.json({ error: "The app catalog couldn't be reached just now, try again" }, 502);
      throw e;
    }
  });

  // any other app: connect and disconnect only. Nothing is imported and no tool ever runs on these connections
  router.use("/apps/:slug", async (c, next) => {
    const slug = c.req.param("slug");
    if (!validAppSlug(slug)) return c.json({ error: "That isn't an app name" }, 400);
    if (isCurated(slug)) return c.json({ error: "Connect that one from its own row", curated: true }, 409);
    return next();
  });

  router.post("/apps/:slug", async (c) => {
    const slug = c.req.param("slug");
    if (!composioConfigured(c.env)) return c.json({ error: "Connecting apps isn't set up on this server yet", configured: false }, 503);
    const body = await c.req.json<{ returnTo?: unknown }>().catch(() => ({}) as { returnTo?: unknown });
    try {
      if ((await appViewFor(c.env, c.var.sessionId, slug))?.status === "connected") return c.json({ error: "That app is already connected" }, 409);
      return c.json(await connectApp(c.env, c.var.sessionId, slug, body.returnTo));
    } catch (e) {
      if (e instanceof AppNotConnectable) return c.json({ error: "That app can't be connected from Skillit yet" }, 422);
      if (e instanceof ComposioNotConfigured) return c.json({ error: "Connecting apps isn't set up on this server yet", configured: false }, 503);
      if (e instanceof ComposioError) return c.json({ error: "That app couldn't be reached just now, try again" }, 502);
      throw e;
    }
  });

  router.delete("/apps/:slug", async (c) => {
    try {
      await disconnectAppSlug(c.env, c.var.sessionId, c.req.param("slug"));
      return c.json({ apps: await listApps(c.env, c.var.sessionId) });
    } catch (e) {
      if (e instanceof ComposioNotConfigured || e instanceof ComposioError) return c.json({ error: "That app couldn't be disconnected just now, try again" }, 502);
      throw e;
    }
  });

  // anything after /:provider names a connector, or the route doesn't exist
  router.use("/:provider/*", async (c, next) => (connectorFor(c.req.param("provider")) ? next() : c.json({ error: "No such connection" }, 404)));
  router.use("/:provider", async (c, next) => (connectorFor(c.req.param("provider")) ? next() : c.json({ error: "No such connection" }, 404)));
  const connectorOf = (c: Context<AppContext>) => connectorFor(c.req.param("provider") ?? "") as Connector;

  // answers with the hosted sign-in to open; returnTo must be the app's scheme or one of our web origins
  router.post("/:provider", async (c) => {
    const connector = connectorOf(c);
    if (!(await isConfigured(c.env, connector))) return c.json(notConfigured(connector), 503);
    const body = await c.req.json<{ returnTo?: unknown }>().catch(() => ({}) as { returnTo?: unknown });
    const view = await viewFor(c.env, c.var.sessionId, connector).catch(() => null);
    if (view?.status === "connected") return c.json({ error: `${connector.name} is already connected` }, 409);
    try {
      return c.json(await startConnect(c.env, c.var.sessionId, connector, body.returnTo));
    } catch (e) {
      return composioFailure(c, connector, e);
    }
  });

  router.post("/:provider/import", async (c) => {
    const connector = connectorOf(c);
    const deps = depsOf(c);
    if (!(await deps.services.claimCooldown(`${connector.id}-import`, c.var.sessionId, IMPORT_COOLDOWN_MS))) {
      return c.json({ error: `${connector.name} was imported a moment ago, try again in a few minutes` }, 429);
    }
    try {
      await importConnection(deps, c.var.sessionId, connector);
      const view = await viewFor(c.env, c.var.sessionId, connector);
      return c.json({ connection: view, ...(connector.id === "github" ? { github: view } : {}) });
    } catch (e) {
      if (e instanceof NotConnected) return c.json({ error: e.message }, 409);
      return composioFailure(c, connector, e);
    }
  });

  router.delete("/:provider", async (c) => {
    const connector = connectorOf(c);
    try {
      await disconnect(c.env, c.var.sessionId, connector);
      const view = await viewFor(c.env, c.var.sessionId, connector);
      return c.json({ connection: view, ...(connector.id === "github" ? { github: view } : {}) });
    } catch (e) {
      return composioFailure(c, connector, e);
    }
  });

  return router;
}

export const connections = connectionsRouter(liveDeps);
