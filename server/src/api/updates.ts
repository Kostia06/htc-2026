import { db } from "../db";
import { Hono } from "hono";
import { RunRejected } from "../agents/core/harness";
import type { AgentDeps } from "../agents/core/types";
import type { AppContext, Env } from "../env";
import { parseTranscript } from "../recap/conversation";
import { DEFAULT_TIMEOUT_MS, runQuickUpdate, UpdateFailed, UpdateTimedOut } from "../updates/run";
import { liteDeps } from "./recap";

type MakeDeps = (env: Env, waitUntil: (work: Promise<unknown>) => void) => AgentDeps;
type Options = { timeoutMs?: number; hourlyLimit?: number };

const MAX_MESSAGE = 2000;
const HOURLY_LIMIT = 60;

// every update is one recorded agent run, so the run log is the rate limiter
async function isRateLimited(env: Env, userId: string, limit: number) {
  const since = new Date(Date.now() - 3600_000).toISOString();
  const row = await db(env).prepare("SELECT count(*) AS n FROM agent_runs WHERE user_id = ? AND skill = 'quick-update' AND created_at > ?")
    .bind(userId, since)
    .first<{ n: number }>();
  return (row?.n ?? 0) >= limit;
}

/** POST /api/updates: one plain-words update, applied at once or answered with one question. The app sends the chat so far back each time. */
export function updatesRouter(makeDeps: MakeDeps, options: Options = {}) {
  const router = new Hono<AppContext>();

  router.post("/", async (c) => {
    const body = await c.req.json<{ message?: unknown; conversation?: unknown; focusStepId?: unknown }>().catch(() => null);
    const conversation = body?.conversation === undefined ? [] : parseTranscript(body.conversation);
    if (!body || !conversation || typeof body.message !== "string" || !body.message.trim() || body.message.length > MAX_MESSAGE) {
      return c.json({ error: "send your update, and the conversation so far if there is one" }, 400);
    }
    const userId = c.var.sessionId;
    if (await isRateLimited(c.env, userId, options.hourlyLimit ?? HOURLY_LIMIT)) return c.json({ error: "that's a lot of updates; take a breather" }, 429);

    const waitUntil = (work: Promise<unknown>) => c.executionCtx.waitUntil(work);
    const messages = [...conversation, { role: "user" as const, text: body.message.trim() }];
    const focusStepId = typeof body.focusStepId === "string" ? body.focusStepId : undefined;
    try {
      const turn = { userId, messages, focusStepId, timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS, waitUntil };
      return c.json(await runQuickUpdate(makeDeps(c.env, waitUntil), turn));
    } catch (e) {
      if (e instanceof RunRejected) return c.json({ error: e.message }, e.status);
      if (e instanceof UpdateFailed) return c.json({ error: "Skillit couldn't follow that one. Try saying it another way." }, 502);
      if (e instanceof UpdateTimedOut) return c.json({ error: "Skillit took too long. Try that again." }, 504);
      throw e;
    }
  });

  return router;
}

export const updates = updatesRouter(liteDeps);
