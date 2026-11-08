import { Hono } from "hono";
import { RunRejected } from "../agents/core/harness";
import type { AgentDeps } from "../agents/core/types";
import { liveDeps } from "../agents/live";
import { MAX_POSTING_TEXT } from "../agents/career/skills/import-posting";
import { db } from "../db";
import type { AppContext, Env } from "../env";
import { ImportFailed } from "../postings/import";
import { parseResume } from "../resume/parse";
import { resumeFile, resumeFileHeaders } from "../resume/download";
import { asFormat, asTemplate } from "../resume/template";
import { applyChanges, matchSummary } from "../resume/tailor/apply";
import { notifyAfterWrite } from "../notifications/generate";
import { NothingToTailor, PostingNotFound, TailorFailed, tailorResume } from "../resume/tailor/create";
import { deleteTailored, findTailored, listTailored, updateTailored } from "../resume/tailor/store";
import type { TailoredContent, TailoredResume } from "../resume/tailor/types";

type MakeDeps = (env: Env, waitUntil: (work: Promise<unknown>) => void) => AgentDeps;
type Options = { hourlyLimit?: number };

const HOURLY_LIMIT = 10;
// a pasted posting is imported first, which is its own model call with the postings endpoint's limit
const IMPORT_HOURLY_LIMIT = 20;

async function runsInLastHour(env: Env, userId: string, skill: string) {
  const since = new Date(Date.now() - 3600_000).toISOString();
  const row = await db(env).prepare("SELECT count(*) AS n FROM agent_runs WHERE user_id = ? AND skill = ? AND created_at > ?")
    .bind(userId, skill, since)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

const isPostingText = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= MAX_POSTING_TEXT;
const asPostingId = (value: unknown) => (typeof value === "string" && /^po_[\w-]{1,64}$/.test(value) ? value : undefined);

type Toggle = { id: string; accepted: boolean };
const asToggles = (value: unknown): Toggle[] | null =>
  Array.isArray(value) && value.every((t) => typeof t?.id === "string" && typeof t?.accepted === "boolean") ? (value as Toggle[]) : null;

// the change log stays true to the resume: toggles rebuild it from the base, and a hand edit freezes the log
function edited(current: TailoredResume, body: { changes?: unknown; resume?: unknown }): TailoredContent | { error: string; status: 400 | 409 } {
  const { id: _id, createdAt: _c, updatedAt: _u, ...content } = current;
  const requirements = [...current.match.covered, ...current.match.missing];
  if (body.resume !== undefined) {
    const resume = parseResume(body.resume);
    if (!resume) return { error: "send the resume as an object", status: 400 };
    return { ...content, resume, editedByHand: true, match: matchSummary(current.base, resume, requirements) };
  }
  const toggles = asToggles(body.changes);
  if (!toggles) return { error: "send changes as [{ id, accepted }] or a whole resume", status: 400 };
  if (current.editedByHand) return { error: "this version was edited by hand, so changes can't be toggled any more; edit it directly", status: 409 };
  const wanted = new Map(toggles.map((t) => [t.id, t.accepted]));
  const changes = current.changes.map((c) => ({ ...c, accepted: wanted.get(c.id) ?? c.accepted }));
  const resume = applyChanges(current.base, changes);
  return { ...content, changes, resume, match: matchSummary(current.base, resume, requirements) };
}

/** /api/resume/tailored: saved copies of the resume adapted to one job each, with what changed and why. */
export function tailoredRouter(makeDeps: MakeDeps, options: Options = {}) {
  const router = new Hono<AppContext>();

  router.get("/", async (c) => c.json({ tailored: await listTailored(c.env, c.var.sessionId) }));

  router.post("/", async (c) => {
    const body = await c.req.json<{ postingId?: unknown; text?: unknown }>().catch(() => null);
    const postingId = asPostingId(body?.postingId);
    const text = !postingId && isPostingText(body?.text) ? body!.text.trim() : undefined;
    if (!postingId && !text) return c.json({ error: "send a saved posting's id, or the posting's text" }, 400);

    const userId = c.var.sessionId;
    const tooMany = (await runsInLastHour(c.env, userId, "resume-tailor")) >= (options.hourlyLimit ?? HOURLY_LIMIT)
      || (text !== undefined && (await runsInLastHour(c.env, userId, "import-posting")) >= IMPORT_HOURLY_LIMIT);
    if (tooMany) return c.json({ error: "that's a lot of tailoring for one hour; try again later" }, 429);

    const deps = makeDeps(c.env, (work) => c.executionCtx.waitUntil(work));
    try {
      const tailored = await tailorResume(deps, { userId, postingId, text });
      notifyAfterWrite(c.env, userId, (work) => c.executionCtx.waitUntil(work));
      return c.json(tailored, 201);
    } catch (e) {
      if (e instanceof PostingNotFound) return c.json({ error: "unknown posting" }, 404);
      if (e instanceof NothingToTailor) return c.json({ error: "add a summary, a bullet or a skill to your resume first" }, 422);
      if (e instanceof ImportFailed) return c.json({ error: "Skillit couldn't make out a job posting there. Check the text and try again." }, 502);
      if (e instanceof TailorFailed) return c.json({ error: "Skillit couldn't tailor the resume just now, try again" }, 502);
      if (e instanceof RunRejected) return c.json({ error: e.message }, e.status);
      throw e;
    }
  });

  router.get("/:id", async (c) => {
    const found = await findTailored(c.env, c.var.sessionId, c.req.param("id"));
    return found ? c.json(found) : c.json({ error: "unknown tailored resume" }, 404);
  });

  router.put("/:id", async (c) => {
    const userId = c.var.sessionId;
    const current = await findTailored(c.env, userId, c.req.param("id"));
    if (!current) return c.json({ error: "unknown tailored resume" }, 404);
    const body = await c.req.json<{ changes?: unknown; resume?: unknown }>().catch(() => null);
    if (!body || typeof body !== "object") return c.json({ error: "send changes or a resume" }, 400);
    const next = edited(current, body);
    if ("error" in next) return c.json({ error: next.error }, next.status);
    return c.json(await updateTailored(c.env, userId, current, next));
  });

  router.delete("/:id", async (c) => {
    const deleted = await deleteTailored(c.env, c.var.sessionId, c.req.param("id"));
    return deleted ? c.json({ deleted: true }) : c.json({ error: "unknown tailored resume" }, 404);
  });

  // the layout is picked per job at download time: ?template=plain for postings that want a bare page
  router.get("/:id/:format{pdf|docx}", async (c) => {
    const format = asFormat(c.req.param("format")) ?? "pdf";
    const found = await findTailored(c.env, c.var.sessionId, c.req.param("id"));
    if (!found) return c.json({ error: "unknown tailored resume" }, 404);
    const file = resumeFile(found.resume, format, asTemplate(c.req.query("template")));
    // header values must be ASCII, and a company name may not be
    const company = found.company.replace(/[^A-Za-z0-9 ]+/g, "").trim().replace(/\s+/g, "-") || "Job";
    return c.body(file.bytes.buffer as ArrayBuffer, 200, resumeFileHeaders(file, `Resume-${company}`, format));
  });

  return router;
}

export const tailored = tailoredRouter(liveDeps);
