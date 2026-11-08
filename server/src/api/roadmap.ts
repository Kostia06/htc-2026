import { Hono } from "hono";
import type { AgentDeps } from "../agents/core/types";
import { liveDeps } from "../agents/live";
import type { AppContext, Env } from "../env";
import { roadmapPage } from "../roadmap/roadmap";
import { setStepStatus } from "../roadmap/store";
import { isStepStatus, STEP_STATUSES } from "../roadmap/types";

type MakeDeps = (env: Env, waitUntil: (work: Promise<unknown>) => void) => AgentDeps;
type Deadlines = { deadlineMs: number; backgroundDeadlineMs: number };

// one Gemini call took about 10 s in a live check; past this the person gets the template rather than a spinner
const LIVE_DEADLINES: Deadlines = { deadlineMs: 12_000, backgroundDeadlineMs: 30_000 };

export function roadmapRouter(makeDeps: MakeDeps, deadlines: Deadlines = LIVE_DEADLINES) {
  const router = new Hono<AppContext>();

  router.get("/", async (c) => {
    const raw = c.req.query("cursor") ?? "0";
    if (!/^\d{1,4}$/.test(raw)) return c.json({ error: "cursor must be a number from nextCursor" }, 400);
    const waitUntil = (work: Promise<unknown>) => c.executionCtx.waitUntil(work);
    const page = await roadmapPage(makeDeps(c.env, waitUntil), c.var.sessionId, Number(raw), { ...deadlines, waitUntil });
    return page ? c.json(page) : c.json({ error: "cursor is past the end of the roadmap" }, 400);
  });

  router.post("/steps/:id", async (c) => {
    const body = await c.req.json<{ status?: unknown }>().catch(() => null);
    if (!isStepStatus(body?.status)) return c.json({ error: `status must be one of ${STEP_STATUSES.join(", ")}` }, 400);
    const updated = await setStepStatus(c.env, c.var.sessionId, c.req.param("id"), body.status);
    return updated ? c.json({ id: c.req.param("id"), status: body.status }) : c.json({ error: "unknown step" }, 404);
  });

  return router;
}

export const roadmap = roadmapRouter(liveDeps);
