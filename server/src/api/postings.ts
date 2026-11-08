import { Hono } from "hono";
import { RunRejected } from "../agents/core/harness";
import type { AgentDeps } from "../agents/core/types";
import { MAX_POSTING_TEXT } from "../agents/career/skills/import-posting";
import { db } from "../db";
import type { AppContext, Env } from "../env";
import { ImportFailed, importPosting, NeedsText } from "../postings/import";
import { findPosting, listPostings } from "../postings/store";
import { liteDeps } from "./recap";

type MakeDeps = (env: Env, waitUntil: (work: Promise<unknown>) => void) => AgentDeps;
type Options = { hourlyLimit?: number };

const HOURLY_LIMIT = 20;
const MAX_URL = 2000;

const isHttpUrl = (value: unknown): value is string => {
  if (typeof value !== "string" || value.length > MAX_URL) return false;
  try {
    return /^https?:$/.test(new URL(value.trim()).protocol);
  } catch {
    return false;
  }
};
const isPostingText = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= MAX_POSTING_TEXT;

// every import is one recorded agent run, so the run log is the rate limiter
async function isRateLimited(env: Env, userId: string, limit: number) {
  const since = new Date(Date.now() - 3600_000).toISOString();
  const row = await db(env).prepare("SELECT count(*) AS n FROM agent_runs WHERE user_id = ? AND skill = 'import-posting' AND created_at > ?")
    .bind(userId, since)
    .first<{ n: number }>();
  return (row?.n ?? 0) >= limit;
}

/** /api/postings: a job posting the person is preparing for, read from a link or pasted text, and what Raven set up from it. */
export function postingsRouter(makeDeps: MakeDeps, options: Options = {}) {
  const router = new Hono<AppContext>();

  router.post("/", async (c) => {
    const body = await c.req.json<{ url?: unknown; text?: unknown }>().catch(() => null);
    const url = isHttpUrl(body?.url) ? body!.url.trim() : undefined;
    const text = !url && isPostingText(body?.text) ? body!.text.trim() : undefined;
    if (!url && !text) return c.json({ error: "send the posting's link, or its text" }, 400);
    const userId = c.var.sessionId;
    if (await isRateLimited(c.env, userId, options.hourlyLimit ?? HOURLY_LIMIT)) return c.json({ error: "that's a lot of postings for one hour; take a breather" }, 429);

    const deps = makeDeps(c.env, (work) => c.executionCtx.waitUntil(work));
    try {
      return c.json(await importPosting(deps, { userId, url, text }), 201);
    } catch (e) {
      if (e instanceof NeedsText) return c.json({ error: "Skillit can't read that site. Paste the posting text instead.", needsText: true, reason: e.message }, 422);
      if (e instanceof RunRejected) return c.json({ error: e.message }, e.status);
      if (e instanceof ImportFailed) return c.json({ error: "Skillit couldn't make out a job posting there. Paste the text and try again." }, 502);
      throw e;
    }
  });

  router.get("/", async (c) => c.json({ postings: await listPostings(c.env, c.var.sessionId) }));

  router.get("/:id", async (c) => {
    const posting = await findPosting(c.env, c.var.sessionId, c.req.param("id"));
    return posting ? c.json(posting) : c.json({ error: "unknown posting" }, 404);
  });

  return router;
}

export const postings = postingsRouter(liteDeps);
