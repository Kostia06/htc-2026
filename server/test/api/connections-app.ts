import { env } from "cloudflare:workers";
import { Hono } from "hono";
import type { AgentDeps } from "../../src/agents/core/types";
import { connectionsRouter } from "../../src/api/connections";
import type { AppContext } from "../../src/env";
import { keyed } from "../connections/fixtures";

/** The connections router behind a fake session (x-test-user), with waitUntil work collected so a test can settle it. */
export function testApp(deps: AgentDeps, bindings: typeof env = keyed) {
  const pending: Promise<unknown>[] = [];
  const executionCtx = { waitUntil: (p: Promise<unknown>) => pending.push(p), passThroughOnException: () => {}, props: {} } as unknown as ExecutionContext;
  const app = new Hono<AppContext>()
    .use(async (c, next) => {
      c.set("sessionId", c.req.header("x-test-user") ?? "u1");
      await next();
    })
    .route("/", connectionsRouter(() => deps));
  const request = (user: string, method: string, path = "/", body?: unknown) =>
    app.request(path, { method, headers: { "x-test-user": user, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }, bindings, executionCtx);
  return { request, settle: () => Promise.all(pending.splice(0)) };
}
