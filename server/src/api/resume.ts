import { Hono } from "hono";
import type { AgentDeps } from "../agents/core/types";
import { liveDeps } from "../agents/live";
import { orchestrate } from "../agents/orchestrator";
import { extractText, MAX_UPLOAD_BYTES, UnreadableDocument } from "../documents/extract";
import type { AppContext, Env } from "../env";
import { emptyProfile } from "../memory/profile/patch";
import { getProfile } from "../memory/profile/store";
import type { ProfilePatch } from "../memory/profile/types";
import { parseResume, seedFromProfile } from "../resume/parse";
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

  // suggestions only: nothing changes until the person accepts one and saves. The builder sends what is on screen,
  // so unsaved edits are reviewed without being saved; without a resume in the body the stored one is used
  router.post("/improve", async (c) => {
    const body = await c.req.json<{ section?: unknown; company?: unknown; resume?: unknown }>().catch(() => null);
    const sent = body?.resume === undefined ? null : parseResume(body.resume);
    if (body?.resume !== undefined && !sent) return c.json({ error: "send the resume as an object" }, 400);
    const userId = c.var.sessionId;
    const [resume, profile] = await Promise.all([sent ?? loadResume(c.env, userId).then((r) => r.resume), getProfile(c.env, userId)]);
    const input = { resume, targetRole: profile.targetRoles[0], section: asSection(body?.section), company: asSlug(body?.company) };
    const waitUntil = (work: Promise<unknown>) => c.executionCtx.waitUntil(work);
    const run = await orchestrate(makeDeps(c.env, waitUntil), { skillId: "resume-coach", platform: "app", userId, input });
    if (run.status === "failed") return c.json({ runId: run.runId, error: "Raven couldn't review the resume just now, try again" }, 502);
    return c.json({ runId: run.runId, suggestions: run.output.suggestions ?? [] });
  });

  // a fresh resume read from a file, laid out for the builder: the file and its text are not kept, and nothing is
  // saved until the person checks it and PUTs it back
  router.post("/upload", async (c) => {
    const form = await c.req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return c.json({ error: "send the resume as a multipart field named file" }, 400);
    if (file.size > MAX_UPLOAD_BYTES) return c.json({ error: "the file is over 5 MB" }, 413);

    let text: string;
    try {
      text = (await extractText(c.env, { bytes: new Uint8Array(await file.arrayBuffer()), name: file.name })).text;
    } catch (e) {
      if (e instanceof UnreadableDocument) return c.json({ error: e.message }, 415);
      throw e;
    }

    const userId = c.var.sessionId;
    const waitUntil = (work: Promise<unknown>) => c.executionCtx.waitUntil(work);
    const run = await orchestrate(makeDeps(c.env, waitUntil), { skillId: "onboarding-prefill", platform: "app", userId, input: { text } });
    if (run.status === "failed") return c.json({ error: "the file was read but Raven couldn't lay it out, try again or fill it in by hand" }, 502);
    const draft = (run.output.draft ?? {}) as ProfilePatch;
    const resume = seedFromProfile({ ...emptyProfile(), ...draft });
    return c.json({ resume, saved: false, droppedClaims: run.output.droppedClaims ?? 0 });
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
