import { rememberContact } from "../resume/store";
import { db } from "../db";
import { Hono } from "hono";
import { RunRejected } from "../agents/core/harness";
import type { AgentDeps } from "../agents/core/types";
import { liveDeps } from "../agents/live";
import { extractText, MAX_UPLOAD_BYTES, UnreadableDocument } from "../documents/extract";
import type { AppContext, Env } from "../env";
import { parseTranscript } from "../recap/conversation";
import { FILE_TIMEOUT_MS, runFileUpdate } from "../updates/file";
import { DEFAULT_TIMEOUT_MS, runQuickUpdate, UpdateFailed, UpdateTimedOut } from "../updates/run";
import { liteDeps } from "./recap";

type MakeDeps = (env: Env, waitUntil: (work: Promise<unknown>) => void) => AgentDeps;
type Options = { timeoutMs?: number; hourlyLimit?: number; fileTimeoutMs?: number; hourlyFileLimit?: number };

const MAX_MESSAGE = 2000;
const HOURLY_LIMIT = 60;
// each file costs a document read on top of the update, so fewer of them
const HOURLY_FILE_LIMIT = 20;

// every update is one recorded agent run, so the run log is the rate limiter
async function isRateLimited(env: Env, userId: string, limit: number, skill = "quick-update") {
  const since = new Date(Date.now() - 3600_000).toISOString();
  const row = await db(env).prepare("SELECT count(*) AS n FROM agent_runs WHERE user_id = ? AND skill = ? AND created_at > ?")
    .bind(userId, skill, since)
    .first<{ n: number }>();
  return (row?.n ?? 0) >= limit;
}

/** POST /api/updates: one plain-words update, applied at once or answered with one question. The app sends the chat so far back each time. */
export function updatesRouter(makeDeps: MakeDeps, options: Options = {}, makeFileDeps: MakeDeps = makeDeps) {
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

  /**
   * POST /api/updates/file: any document, any time (transcript, certificate, resume, cover letter, portfolio). It is read,
   * turned into the same kind of updates, and forgotten: neither the file nor its text is kept.
   */
  router.post("/file", async (c) => {
    const form = await c.req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return c.json({ error: "send the document as a multipart field named file" }, 400);
    if (file.size > MAX_UPLOAD_BYTES) return c.json({ error: "the file is over 5 MB" }, 413);
    const userId = c.var.sessionId;
    if (await isRateLimited(c.env, userId, options.hourlyFileLimit ?? HOURLY_FILE_LIMIT, "document-update")) {
      return c.json({ error: "that's a lot of files; take a breather" }, 429);
    }

    let text: string;
    try {
      text = (await extractText(c.env, { bytes: new Uint8Array(await file.arrayBuffer()), name: file.name })).text;
    } catch (e) {
      if (e instanceof UnreadableDocument) return c.json({ error: e.message }, 415);
      throw e;
    }

    const waitUntil = (work: Promise<unknown>) => c.executionCtx.waitUntil(work);
    waitUntil(rememberContact(c.env, userId, text).catch((e) => console.warn("[file-update] contact not kept:", (e as Error).message)));
    try {
      const turn = { userId, fileName: file.name, text, timeoutMs: options.fileTimeoutMs ?? FILE_TIMEOUT_MS, waitUntil };
      return c.json(await runFileUpdate(makeFileDeps(c.env, waitUntil), turn));
    } catch (e) {
      if (e instanceof RunRejected) return c.json({ error: e.message }, e.status);
      if (e instanceof UpdateFailed) return c.json({ error: "Skillit read the file but couldn't use it. Try again in a moment." }, 502);
      if (e instanceof UpdateTimedOut) return c.json({ error: "Skillit took too long reading that. Try again." }, 504);
      throw e;
    }
  });

  return router;
}

// a document needs the main model's care; a typed update is short enough for the lite one
export const updates = updatesRouter(liteDeps, {}, liveDeps);
