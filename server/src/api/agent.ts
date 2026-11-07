import { Hono } from "hono";
import { RunRejected, startSkill } from "../agents/core/harness";
import { findRun } from "../agents/core/runs";
import { PLATFORMS, type AgentDeps, type Platform, type Skill } from "../agents/core/types";
import { liveDeps } from "../agents/live";
import { skills } from "../agents/skills";
import type { AppContext, Env } from "../env";

type MakeDeps = (env: Env, waitUntil: (work: Promise<unknown>) => void) => AgentDeps;

const isBackgroundOnly = (skill: Skill) => skill.platforms.every((p) => p === "background");

export function agentRouter(makeDeps: MakeDeps) {
  const router = new Hono<AppContext>();

  router.post("/:skill", async (c) => {
    const skill = skills[c.req.param("skill")];
    if (!skill) return c.json({ error: "unknown skill" }, 404);
    const body = await c.req.json<{ platform?: unknown; input?: unknown }>().catch(() => null);
    if (!body || !PLATFORMS.includes(body.platform as Platform)) return c.json({ error: "platform must be app, vr or background" }, 400);

    const waitUntil = (work: Promise<unknown>) => c.executionCtx.waitUntil(work);
    const request = { skill, platform: body.platform as Platform, userId: c.var.sessionId, input: body.input ?? {} };
    try {
      const { runId, result } = await startSkill(makeDeps(c.env, waitUntil), request);
      if (isBackgroundOnly(skill)) {
        waitUntil(result);
        return c.json({ runId }, 202);
      }
      const run = await result;
      if (run.status === "failed") return c.json({ runId, error: "the agent could not finish this task" }, 502);
      return c.json({ runId, output: run.output });
    } catch (e) {
      if (e instanceof RunRejected) return c.json({ error: e.message }, e.status);
      throw e;
    }
  });

  router.get("/runs/:id", async (c) => {
    const run = await findRun(c.env, c.req.param("id"), c.var.sessionId);
    return run ? c.json(run) : c.json({ error: "unknown run" }, 404);
  });

  return router;
}

export const agent = agentRouter(liveDeps);
