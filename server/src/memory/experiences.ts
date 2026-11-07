import type { Env } from "../env";
import { scrubNames } from "../integrations/gemini";
import { anonymize } from "../lib/anonymize";
import { upsertVector } from "./vectors";

const HOURLY_LIMIT = 5;
const MAX_QUESTIONS = 15;
const MAX_LEN = 500;

// swapped out in tests: Gemini and Vectorize only exist remotely
export const deps = { scrubNames, upsertVector };

type ExperienceSubmission = {
  companySlug: string;
  role: string;
  questions: string[];
  format?: string;
  outcome?: string;
  tips?: string;
  authorName?: string;
};

export type SubmissionResult =
  | { status: 201; body: { ok: true } }
  | { status: 400 | 404 | 429; body: { error: string } };

const isText = (v: unknown, optional = true) => (v === undefined && optional) || (typeof v === "string" && v.length <= MAX_LEN);

function isSubmission(body: unknown): body is ExperienceSubmission {
  const s = body as ExperienceSubmission | null;
  return (
    !!s &&
    typeof s.companySlug === "string" &&
    isText(s.role, false) &&
    Array.isArray(s.questions) &&
    s.questions.length <= MAX_QUESTIONS &&
    s.questions.every((q) => isText(q, false)) &&
    [s.format, s.outcome, s.tips, s.authorName].every((v) => isText(v))
  );
}

async function isRateLimited(env: Env, sessionId: string) {
  const since = new Date(Date.now() - 3600_000).toISOString();
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM submission_log WHERE session_id = ? AND created_at > ?")
    .bind(sessionId, since)
    .first<{ n: number }>();
  return (recent?.n ?? 0) >= HOURLY_LIMIT;
}

// the single path every public interview report goes through: validate, rate limit, anonymize, Gemini name scrub, store, embed
export async function submitExperience(env: Env, sessionId: string, submission: unknown): Promise<SubmissionResult> {
  if (!isSubmission(submission)) {
    return { status: 400, body: { error: `send a role and 1-${MAX_QUESTIONS} questions as text, each under ${MAX_LEN} characters` } };
  }
  const questions = submission.questions.map((q) => q.trim()).filter(Boolean);
  if (!submission.role.trim() || questions.length === 0) return { status: 400, body: { error: "role and at least one question are required" } };

  const company = await env.DB.prepare("SELECT id FROM companies WHERE slug = ?").bind(submission.companySlug).first<{ id: string }>();
  if (!company) return { status: 404, body: { error: "unknown company" } };

  if (await isRateLimited(env, sessionId)) return { status: 429, body: { error: "too many submissions, try again later" } };

  const names = submission.authorName ? [submission.authorName] : [];
  const clean = (s = "") => anonymize(s, names);
  const fields: Record<string, string> = {
    role: clean(submission.role.trim()),
    format: clean(submission.format),
    outcome: clean(submission.outcome),
    tips: clean(submission.tips),
    ...Object.fromEntries(questions.map((q, i) => [`q${i}`, clean(q)])),
  };
  const scrubbed = await deps.scrubNames(env, fields);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const cleanQuestions = questions.map((_, i) => scrubbed[`q${i}`]);
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO experiences (id, company_id, role, questions_json, format, outcome, tips, is_seeded, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)",
    ).bind(id, company.id, scrubbed.role, JSON.stringify(cleanQuestions), scrubbed.format, scrubbed.outcome, scrubbed.tips, now),
    env.DB.prepare("INSERT INTO submission_log (session_id, created_at) VALUES (?, ?)").bind(sessionId, now),
  ]);
  await deps.upsertVector(env, `exp:${id}`, `${scrubbed.role}: ${cleanQuestions.join(" | ")}`, { company_id: company.id, kind: "exp" });

  return { status: 201, body: { ok: true } };
}
