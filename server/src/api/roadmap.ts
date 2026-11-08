import { Hono } from "hono";
import type { AgentDeps } from "../agents/core/types";
import { liveDeps } from "../agents/live";
import type { AppContext, Env } from "../env";
import { isTimeZone } from "../roadmap/progress";
import { roadmapPage } from "../roadmap/roadmap";
import { setStepStatus } from "../roadmap/store";
import { isStepStatus, STEP_STATUSES } from "../roadmap/types";

type MakeDeps = (env: Env, waitUntil: (work: Promise<unknown>) => void) => AgentDeps;

// the response never waits for this: it only bounds how long the background refinement may run
const LIVE_REFINE_DEADLINE_MS = 30_000;
const MAX_NOTE = 500;

export function roadmapRouter(makeDeps: MakeDeps, refineDeadlineMs = LIVE_REFINE_DEADLINE_MS) {
  const router = new Hono<AppContext>();

  router.get("/", async (c) => {
    const raw = c.req.query("cursor") ?? "0";
    if (!/^\d{1,4}$/.test(raw)) return c.json({ error: "cursor must be a number from nextCursor" }, 400);
    const tz = c.req.query("tz") ?? "UTC";
    const timeZone = isTimeZone(tz) ? tz : "UTC";
    const waitUntil = (work: Promise<unknown>) => c.executionCtx.waitUntil(work);
    const page = await roadmapPage(makeDeps(c.env, waitUntil), c.var.sessionId, Number(raw), { timeZone, refineDeadlineMs, waitUntil });
    return page ? c.json(page) : c.json({ error: "cursor is past the end of the roadmap" }, 400);
  });

  router.post("/steps/:id", async (c) => {
    const body = await c.req.json<{ status?: unknown; note?: unknown }>().catch(() => null);
    if (!isStepStatus(body?.status)) return c.json({ error: `status must be one of ${STEP_STATUSES.join(", ")}` }, 400);
    if (body.note !== undefined && (typeof body.note !== "string" || body.note.length > MAX_NOTE)) {
      return c.json({ error: `note must be a string of at most ${MAX_NOTE} characters` }, 400);
    }
    const step = await setStepStatus(c.env, c.var.sessionId, c.req.param("id"), body.status, body.note?.trim());
    return step ? c.json(step) : c.json({ error: "unknown step" }, 404);
  });

  return router;
}

export const roadmap = roadmapRouter(liveDeps);
