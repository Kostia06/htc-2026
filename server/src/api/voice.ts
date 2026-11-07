import { Hono } from "hono";
import { runSkill } from "../agents/core/harness";
import type { AgentDeps, Platform } from "../agents/core/types";
import { liveDeps } from "../agents/live";
import { interviewDebrief } from "../agents/skills/interview-debrief";
import { networkingRecap } from "../agents/skills/networking-recap";
import type { AppContext, Env } from "../env";
import { ProviderNotConfigured } from "../voice/providers";
import { scoreTurn } from "../voice/score";
import { startVoiceSession, UnknownCompany } from "../voice/session";
import { addTurn, countSessionsSince, findSession, finishSession, listTurns, type StoredTurn, type VoiceSession } from "../voice/store";
import { VOICE_MODES, type VoiceMode } from "../voice/types";

const SESSIONS_PER_HOUR = 10;
const MAX_ANSWER = 4000;

type MakeDeps = (env: Env, waitUntil: (work: Promise<unknown>) => void) => AgentDeps;

const isText = (value: unknown, max: number): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= max;
const optionalText = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim().slice(0, 100) : undefined);

const averageOutOfTen = (turn: StoredTurn) => {
  const values = Object.values(turn.scores);
  return values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 2) : 5;
};

function debriefRequest(session: VoiceSession, turns: StoredTurn[], userId: string, platform: Platform) {
  const role = session.plan.role;
  if (session.mode === "networking") {
    return { skill: networkingRecap, platform, userId, input: { role, exchanges: turns.map(({ question, answer, tip }) => ({ question, answer, tip })) } };
  }
  const answers = turns.map((t) => ({ question: t.question, answer: t.answer, score: averageOutOfTen(t), feedback: t.tip }));
  return { skill: interviewDebrief, platform, userId, input: { company: session.companySlug ?? undefined, role, answers } };
}

export function voiceRouter(makeDeps: MakeDeps) {
  const router = new Hono<AppContext>();

  router.post("/sessions", async (c) => {
    const body = await c.req.json<{ mode?: unknown; companySlug?: unknown; role?: unknown }>().catch(() => null);
    if (!body || !VOICE_MODES.includes(body.mode as VoiceMode)) return c.json({ error: "mode must be interview or networking" }, 400);
    const userId = c.var.sessionId;
    if ((await countSessionsSince(c.env, userId, new Date(Date.now() - 3600_000))) >= SESSIONS_PER_HOUR) {
      return c.json({ error: "that's a lot of practice for one hour, take a break and try again soon" }, 429);
    }
    try {
      const started = await startVoiceSession(c.env, userId, { mode: body.mode as VoiceMode, companySlug: optionalText(body.companySlug), role: optionalText(body.role) });
      return c.json(started, 201);
    } catch (e) {
      if (e instanceof UnknownCompany) return c.json({ error: "unknown company" }, 404);
      if (e instanceof ProviderNotConfigured) return c.json({ error: "voice practice isn't set up on this server yet" }, 503);
      throw e;
    }
  });

  // the fast path: Jev and code only, so feedback lands while the next question is being asked
  router.post("/sessions/:id/turns", async (c) => {
    const session = await findSession(c.env, c.var.sessionId, c.req.param("id"));
    if (!session) return c.json({ error: "unknown session" }, 404);
    if (session.status === "finished") return c.json({ error: "this session has ended" }, 409);
    const body = await c.req.json<{ question?: unknown; answer?: unknown; durationMs?: unknown }>().catch(() => null);
    if (!body || !isText(body.question, 1000) || !isText(body.answer, MAX_ANSWER)) return c.json({ error: "send the question and the answer text" }, 400);
    const durationMs = typeof body.durationMs === "number" && body.durationMs > 0 ? body.durationMs : 0;

    const score = await scoreTurn(c.env, { mode: session.mode, question: body.question, answer: body.answer, durationMs });
    await addTurn(c.env, c.var.sessionId, session.id, { question: body.question, answer: body.answer, score });
    return c.json(score);
  });

  router.post("/sessions/:id/finish", async (c) => {
    const userId = c.var.sessionId;
    const session = await findSession(c.env, userId, c.req.param("id"));
    if (!session) return c.json({ error: "unknown session" }, 404);
    const turns = await listTurns(c.env, userId, session.id);
    if (turns.length === 0) return c.json({ error: "nothing was said in this session yet" }, 400);
    const body = await c.req.json<{ platform?: unknown }>().catch(() => ({}) as { platform?: unknown });
    const platform: Platform = body.platform === "vr" ? "vr" : "app";

    await finishSession(c.env, userId, session.id);
    const waitUntil = (work: Promise<unknown>) => c.executionCtx.waitUntil(work);
    const run = await runSkill(makeDeps(c.env, waitUntil), debriefRequest(session, turns, userId, platform));
    if (run.status === "failed") return c.json({ error: "the session was saved but the debrief could not be made" }, 502);
    return c.json(run.output);
  });

  router.get("/sessions/:id", async (c) => {
    const session = await findSession(c.env, c.var.sessionId, c.req.param("id"));
    if (!session) return c.json({ error: "unknown session" }, 404);
    const { plan: _, ...summary } = session;
    return c.json({ ...summary, turns: await listTurns(c.env, c.var.sessionId, session.id) });
  });

  return router;
}

export const voice = voiceRouter(liveDeps);
