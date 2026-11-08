import { Hono } from "hono";
import type { AgentDeps } from "../agents/core/types";
import { liveDeps } from "../agents/live";
import { orchestrate } from "../agents/orchestrator";
import { extractText, MAX_UPLOAD_BYTES, UnreadableDocument } from "../documents/extract";
import { detectFormat } from "../documents/formats";
import type { AppContext, Env } from "../env";
import { emptyProfile } from "../memory/profile/patch";
import { getProfile } from "../memory/profile/store";
import type { ProfilePatch } from "../memory/profile/types";
import { maskLinkedinText } from "../resume/linkedin";
import { parseResume, seedFromProfile } from "../resume/parse";
import { renderResumePDF } from "../resume/pdf";
import { loadResume, putResume } from "../resume/store";
import { RESUME_SECTIONS, type ResumeSection } from "../resume/types";
import { buildResumeIntelligence } from "../agents/tools/resume-builder";

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
    if (run.status === "failed") return c.json({ runId: run.runId, error: "Skillit couldn't review the resume just now, try again" }, 502);
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
    if (run.status === "failed") return c.json({ error: "the file was read but Skillit couldn't lay it out, try again or fill it in by hand" }, 502);
    const draft = (run.output.draft ?? {}) as ProfilePatch;
    const resume = seedFromProfile({ ...emptyProfile(), ...draft });
    return c.json({ resume, saved: false, droppedClaims: run.output.droppedClaims ?? 0 });
  });

  // LinkedIn has no API we may use, so the person brings their own "Save to PDF" export. The file is read and forgotten:
  // nothing is stored, and only the text with emails, phones and links masked reaches the reviewing model
  router.post("/linkedin", async (c) => {
    const form = await c.req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return c.json({ error: "send the LinkedIn PDF as a multipart field named file" }, 400);
    if (file.size > MAX_UPLOAD_BYTES) return c.json({ error: "the file is over 5 MB" }, 413);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (detectFormat(bytes, file.name) !== "pdf") return c.json({ error: "send the PDF from LinkedIn's More → Save to PDF" }, 415);

    let text: string;
    try {
      text = maskLinkedinText((await extractText(c.env, { bytes, name: file.name })).text);
    } catch (e) {
      if (e instanceof UnreadableDocument) return c.json({ error: e.message }, 415);
      throw e;
    }

    const userId = c.var.sessionId;
    const targetRole = (await getProfile(c.env, userId)).targetRoles[0];
    const waitUntil = (work: Promise<unknown>) => c.executionCtx.waitUntil(work);
    const run = await orchestrate(makeDeps(c.env, waitUntil), { skillId: "linkedin-review", platform: "app", userId, input: { text, targetRole } });
    if (run.status === "failed") return c.json({ error: "the PDF was read but Skillit couldn't review it just now, try again" }, 502);
    return c.json({ targetRole: targetRole ?? null, suggestions: run.output.suggestions ?? [], droppedClaims: run.output.droppedClaims ?? 0 });
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

  // AI-powered career and resume analysis
  router.post("/analyze", async (c) => {
    const body = await c.req.json<{
      targetRole?: unknown;
      location?: unknown;
      resumeText?: unknown;
      preferredLanguages?: unknown;
      timeBudgetHours?: unknown;
    }>().catch(() => null);

    const targetRole =
        typeof body?.targetRole === "string"
            ? body.targetRole.trim().slice(0, 120)
            : "";

    const location =
        typeof body?.location === "string"
            ? body.location.trim().slice(0, 100)
            : "";

    const resumeText =
        typeof body?.resumeText === "string"
            ? body.resumeText.trim().slice(0, 30000)
            : "";

    const preferredLanguages = Array.isArray(body?.preferredLanguages)
        ? body.preferredLanguages
            .filter((v): v is string => typeof v === "string")
            .map((v) => v.trim())
            .filter(Boolean)
            .slice(0, 10)
        : [];

    const allowedHours = [10, 25, 50, 100];

    const timeBudgetHours =
        typeof body?.timeBudgetHours === "number" &&
        allowedHours.includes(body.timeBudgetHours)
            ? body.timeBudgetHours
            : 25;

    if (!targetRole || !location || !resumeText) {
      return c.json(
          { error: "targetRole, location and resumeText are required" },
          400
      );
    }

    try {
      const data = await buildResumeIntelligence(c.env, {
        targetRole,
        location,
        resumeText,
        preferredLanguages,
        timeBudgetHours,
      });

      return c.json({
        success: true,
        data,
      });
    } catch (error) {
      console.error("Resume intelligence analysis failed", error);

      return c.json(
          {
            error: "Resume analysis failed. Please try again.",
          },
          502
      );
    }
  });

  return router;
}

export const resume = resumeRouter(liveDeps);
