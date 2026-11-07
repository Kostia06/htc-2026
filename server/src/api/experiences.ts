import { Hono } from "hono";
import { scrubNames } from "../integrations/gemini";
import type { AppContext } from "../env";
import { anonymize } from "../lib/anonymize";
import { upsertVector } from "../memory/vectors";

const HOURLY_LIMIT = 5;
const MAX_QUESTIONS = 15;
const MAX_LEN = 500;

// swapped out in tests: Gemini and Vectorize only exist remotely
export const deps = { scrubNames, upsertVector };

type Submission = {
  companySlug: string;
  role: string;
  questions: string[];
  format?: string;
  outcome?: string;
  tips?: string;
  authorName?: string;
};

export const experiences = new Hono<AppContext>();

experiences.post("/", async (c) => {
  const body = await c.req.json<Submission>().catch(() => null);
  const isText = (v: unknown, optional = true) => (v === undefined && optional) || (typeof v === "string" && v.length <= MAX_LEN);
  if (
    !body ||
    typeof body.companySlug !== "string" ||
    !isText(body.role, false) ||
    !Array.isArray(body.questions) ||
    body.questions.length > MAX_QUESTIONS ||
    !body.questions.every((q) => isText(q, false)) ||
    ![body.format, body.outcome, body.tips, body.authorName].every((v) => isText(v))
  ) {
    return c.json({ error: `send a role and 1-${MAX_QUESTIONS} questions as text, each under ${MAX_LEN} characters` }, 400);
  }
  const questions = body.questions.map((q) => q.trim()).filter(Boolean);
  if (!body.role.trim() || questions.length === 0) return c.json({ error: "role and at least one question are required" }, 400);

  const company = await c.env.DB.prepare("SELECT id FROM companies WHERE slug = ?").bind(body.companySlug).first<{ id: string }>();
  if (!company) return c.json({ error: "unknown company" }, 404);

  const since = new Date(Date.now() - 3600_000).toISOString();
  const recent = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM submission_log WHERE session_id = ? AND created_at > ?")
    .bind(c.var.sessionId, since)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= HOURLY_LIMIT) return c.json({ error: "too many submissions, try again later" }, 429);

  const names = body.authorName ? [body.authorName] : [];
  const clean = (s = "") => anonymize(s, names);
  const fields: Record<string, string> = {
    role: clean(body.role.trim()),
    format: clean(body.format),
    outcome: clean(body.outcome),
    tips: clean(body.tips),
    ...Object.fromEntries(questions.map((q, i) => [`q${i}`, clean(q)])),
  };
  const scrubbed = await deps.scrubNames(c.env, fields);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const cleanQuestions = questions.map((_, i) => scrubbed[`q${i}`]);
  await c.env.DB.batch([
    c.env.DB.prepare(
      "INSERT INTO experiences (id, company_id, role, questions_json, format, outcome, tips, is_seeded, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)",
    ).bind(id, company.id, scrubbed.role, JSON.stringify(cleanQuestions), scrubbed.format, scrubbed.outcome, scrubbed.tips, now),
    c.env.DB.prepare("INSERT INTO submission_log (session_id, created_at) VALUES (?, ?)").bind(c.var.sessionId, now),
  ]);
  await deps.upsertVector(c.env, `exp:${id}`, `${scrubbed.role}: ${cleanQuestions.join(" | ")}`, { company_id: company.id, kind: "exp" });

  return c.json({ ok: true }, 201);
});
