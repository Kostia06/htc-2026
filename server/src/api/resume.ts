import { Hono } from "hono";
import type { AgentDeps } from "../agents/core/types";
import { liveDeps } from "../agents/live";
import { orchestrate } from "../agents/orchestrator";
import type { AppContext, Env } from "../env";
import { getProfile } from "../memory/profile/store";
import { parseResume } from "../resume/parse";
import { renderResumePDF } from "../resume/pdf";
import { loadResume, putResume } from "../resume/store";
import { RESUME_SECTIONS, type ResumeSection } from "../resume/types";

type MakeDeps = (env: Env, waitUntil: (work: Promise<unknown>) => void) => AgentDeps;

const asSection = (value: unknown) => RESUME_SECTIONS.find((s) => s === value) as ResumeSection | undefined;
const asSlug = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

export function resumeRouter(makeDeps: MakeDeps) {
  const router = new Hono<AppContext>();

  // saved: false means this is the profile laid out as a resume, not something the person has saved yet
  router.get("/", async (c) => c.json(await loadResume(c.env, c.var.sessionId)));

  // the whole resume comes back each time; the app edits locally and saves the result
  router.put("/", async (c) => {
    const resume = parseResume(await c.req.json().catch(() => null));
    if (!resume) return c.json({ error: "send the resume as an object" }, 400);
    return c.json({ resume: await putResume(c.env, c.var.sessionId, resume), saved: true });
  });

  // suggestions only: nothing changes until the person accepts one and saves
  router.post("/improve", async (c) => {
    const body = await c.req.json<{ section?: unknown; company?: unknown }>().catch(() => null);
    const userId = c.var.sessionId;
    const [{ resume }, profile] = await Promise.all([loadResume(c.env, userId), getProfile(c.env, userId)]);
    const input = { resume, targetRole: profile.targetRoles[0], section: asSection(body?.section), company: asSlug(body?.company) };
    const waitUntil = (work: Promise<unknown>) => c.executionCtx.waitUntil(work);
    const run = await orchestrate(makeDeps(c.env, waitUntil), { skillId: "resume-coach", platform: "app", userId, input });
    if (run.status === "failed") return c.json({ runId: run.runId, error: "Raven couldn't review the resume just now, try again" }, 502);
    return c.json({ runId: run.runId, suggestions: run.output.suggestions ?? [] });
  });

  router.get("/pdf", async (c) => {
    const { resume } = await loadResume(c.env, c.var.sessionId);
    const { bytes, truncated } = renderResumePDF(resume);
    return c.body(bytes.buffer as ArrayBuffer, 200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="Resume.pdf"',
      "X-Resume-Truncated": truncated ? "1" : "0",
    });
  });

  return router;
}

export const resume = resumeRouter(liveDeps);
