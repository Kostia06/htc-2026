import { type Context, Hono } from "hono";
import { RunRejected } from "../agents/core/harness";
import type { AgentDeps } from "../agents/core/types";
import { AskFailed, askCrossroads } from "../crossroads/ask";
import { finishExploreStep } from "../crossroads/explore-step";
import { standBehind } from "../crossroads/patterns";
import { crossroadsFor } from "../crossroads/view";
import { db } from "../db";
import type { AppContext, Env } from "../env";
import { parseTranscript } from "../recap/conversation";
import { liteDeps } from "./recap";

type MakeDeps = (env: Env, waitUntil: (work: Promise<unknown>) => void) => AgentDeps;
type Options = { hourlyLimit?: number };

const MAX_MESSAGE = 1000;
const HOURLY_LIMIT = 30;

// every question is one recorded agent run, so the run log is the rate limiter
async function isRateLimited(env: Env, userId: string, limit: number) {
  const since = new Date(Date.now() - 3600_000).toISOString();
  const row = await db(env).prepare("SELECT count(*) AS n FROM agent_runs WHERE user_id = ? AND skill = 'crossroads-ask' AND created_at > ?")
    .bind(userId, since)
    .first<{ n: number }>();
  return (row?.n ?? 0) >= limit;
}

/** Crossroads: the person's own notes next to everyone on their road, and a way to ask how they line up. */
export function crossroadsRouter(makeDeps: MakeDeps, options: Options = {}) {
  const router = new Hono<AppContext>();

  router.get("/", async (c) => {
    const view = await crossroadsFor(c.env, c.var.sessionId);
    // opening the screen is the whole roadmap step
    await finishExploreStep(c.env, c.var.sessionId);
    return c.json(view);
  });

  router.post("/ask", async (c) => {
    const body = await c.req.json<{ message?: unknown; conversation?: unknown }>().catch(() => null);
    const conversation = body?.conversation === undefined ? [] : parseTranscript(body.conversation);
    if (!body || !conversation || typeof body.message !== "string" || !body.message.trim() || body.message.length > MAX_MESSAGE) {
      return c.json({ error: `send a question under ${MAX_MESSAGE} characters, and the conversation so far if there is one` }, 400);
    }
    const userId = c.var.sessionId;
    if (await isRateLimited(c.env, userId, options.hourlyLimit ?? HOURLY_LIMIT)) return c.json({ error: "that's a lot of questions; try again in a bit" }, 429);

    const deps = makeDeps(c.env, (work) => c.executionCtx.waitUntil(work));
    try {
      return c.json(await askCrossroads(deps, userId, [...conversation, { role: "user", text: body.message.trim() }]));
    } catch (e) {
      if (e instanceof RunRejected) return c.json({ error: e.message }, e.status);
      if (e instanceof AskFailed) return c.json({ error: "Crossroads couldn't answer that one. Try asking another way." }, 502);
      throw e;
    }
  });

  const meToo = (behind: boolean) => async (c: Context<AppContext>) => {
    const result = await standBehind(c.env, c.var.sessionId, c.req.param("id") ?? "", behind);
    return result ? c.json({ meToo: behind, line: result.line }) : c.json({ error: "unknown line" }, 404);
  };
  router.post("/lines/:id/me-too", meToo(true));
  router.delete("/lines/:id/me-too", meToo(false));

  return router;
}

export const crossroads = crossroadsRouter(liteDeps);
