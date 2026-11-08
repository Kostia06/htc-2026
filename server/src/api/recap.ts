import { db } from "../db";
import { Hono, type Context } from "hono";
import { RunRejected } from "../agents/core/harness";
import type { AgentDeps } from "../agents/core/types";
import { liveDeps } from "../agents/live";
import type { AppContext, Env } from "../env";
import { clarifyingQuestionsLeft, hasSomethingToSay, parseHistory, parseTranscript } from "../recap/conversation";
import { RecapFailed, runRecapTurn } from "../recap/run";
import { findRecapVoice, finishRecapVoice, startRecapVoice } from "../recap/voice";
import { ProviderNotConfigured } from "../voice/providers";

type MakeDeps = (env: Env, waitUntil: (work: Promise<unknown>) => void) => AgentDeps;

const MAX_MESSAGE = 4000;
const optionalSlug = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim().slice(0, 100) : undefined);

// a recap is a short read of a short chat: the lite model answers in about a second, the main one is the fallback
function liteDeps(env: Env, waitUntil: (work: Promise<unknown>) => void): AgentDeps {
  const lite = env.GEMINI_FALLBACK_MODEL ?? env.GEMINI_MODEL;
  return liveDeps({ ...env, GEMINI_MODEL: lite, GEMINI_FALLBACK_MODEL: env.GEMINI_MODEL }, waitUntil);
}

async function findCompany(env: Env, slug: string | undefined) {
  if (!slug) return undefined;
  return (await db(env).prepare("SELECT slug, name FROM companies WHERE slug = ?").bind(slug).first<{ slug: string; name: string }>()) ?? undefined;
}

export function recapRouter(makeDeps: MakeDeps) {
  const router = new Hono<AppContext>();

  // one chat turn: the whole history comes back each time, so the server keeps no chat state
  router.post("/", async (c) => {
    const body = await c.req.json<{ companySlug?: unknown; message?: unknown; history?: unknown }>().catch(() => null);
    const history = parseHistory(body?.history);
    if (!body || !history || typeof body.message !== "string" || !body.message.trim() || body.message.length > MAX_MESSAGE) {
      return c.json({ error: "send your message and the conversation so far" }, 400);
    }
    const companySlug = optionalSlug(body.companySlug);
    if (companySlug && !(await findCompany(c.env, companySlug))) return c.json({ error: "unknown company" }, 404);

    const messages = [...history, { role: "user" as const, text: body.message.trim() }];
    const deps = makeDeps(c.env, (work) => c.executionCtx.waitUntil(work));
    try {
      return c.json(await runRecapTurn(deps, { userId: c.var.sessionId, companySlug, messages, questionsLeft: clarifyingQuestionsLeft(history) }));
    } catch (e) {
      return recapError(c, e);
    }
  });

  router.post("/voice", async (c) => {
    const body = await c.req.json<{ companySlug?: unknown }>().catch(() => ({}) as { companySlug?: unknown });
    const companySlug = optionalSlug(body.companySlug);
    const company = await findCompany(c.env, companySlug);
    if (companySlug && !company) return c.json({ error: "unknown company" }, 404);
    try {
      return c.json(await startRecapVoice(c.env, c.var.sessionId, company), 201);
    } catch (e) {
      if (e instanceof ProviderNotConfigured) return c.json({ error: "voice isn't set up on this server yet" }, 503);
      throw e;
    }
  });

  // the call is over: the transcript gets the same read as a typed recap, with no questions left to ask
  router.post("/voice/:id/finish", async (c) => {
    const userId = c.var.sessionId;
    const session = await findRecapVoice(c.env, userId, c.req.param("id"));
    if (!session) return c.json({ error: "unknown session" }, 404);
    if (session.finishedAt) return c.json({ error: "this recap has already been handed in" }, 409);
    const body = await c.req.json<{ transcript?: unknown }>().catch(() => null);
    const messages = parseTranscript(body?.transcript);
    if (!messages) return c.json({ error: "send the transcript as speaker and text lines" }, 400);
    if (!hasSomethingToSay(messages)) return c.json({ error: "nothing was said in this call yet" }, 400);

    await finishRecapVoice(c.env, userId, session.id);
    const deps = makeDeps(c.env, (work) => c.executionCtx.waitUntil(work));
    try {
      return c.json(await runRecapTurn(deps, { userId, companySlug: session.companySlug, messages, questionsLeft: 0 }));
    } catch (e) {
      return recapError(c, e);
    }
  });

  return router;
}

function recapError(c: Context<AppContext>, e: unknown) {
  if (e instanceof RunRejected) return c.json({ error: e.message }, e.status);
  if (e instanceof RecapFailed) return c.json({ error: "Raven couldn't follow that one. Try saying it another way." }, 502);
  throw e;
}

export const recap = recapRouter(liteDeps);
