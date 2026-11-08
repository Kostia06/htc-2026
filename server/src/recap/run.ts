import type { AgentDeps } from "../agents/core/types";
import { summaryReply, type RecapExtracted, type RecapMessage, type RecapOutput } from "../agents/interview/skills/interview-recap";
import { orchestrate } from "../agents/orchestrator";
import type { Env } from "../env";
import { submitExperience } from "../memory/experiences";

export type RecapResult = {
  reply: string;
  done: boolean;
  extracted?: RecapExtracted;
  /** true once the questions went into the anonymised pool other people see */
  shared?: boolean;
};

export class RecapFailed extends Error {}

type RecapTurn = { userId: string; companySlug?: string; messages: RecapMessage[]; questionsLeft: number };

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// the app may already know the company; otherwise the one the person named has to match a company we track
async function resolveCompany(env: Env, companySlug: string | undefined, named: string | undefined) {
  if (companySlug) {
    return env.DB.prepare("SELECT slug, name FROM companies WHERE slug = ?").bind(companySlug).first<{ slug: string; name: string }>();
  }
  const name = named?.trim();
  if (!name) return null;
  return env.DB.prepare("SELECT slug, name FROM companies WHERE slug = ? OR lower(name) = lower(?) OR lower(name) LIKE lower(?) LIMIT 1")
    .bind(slugify(name), name, `${name}%`)
    .first<{ slug: string; name: string }>();
}

async function share(env: Env, userId: string, companySlug: string, extracted: RecapExtracted) {
  if (!extracted.role?.trim() || extracted.questions.length === 0) return false;
  const result = await submitExperience(env, userId, {
    companySlug,
    role: extracted.role,
    questions: extracted.questions,
    format: extracted.round,
    outcome: extracted.outcome,
    tips: extracted.tip,
  });
  if (result.status !== 201) console.warn("recap not shared", result.status, result.body.error);
  return result.status === 201;
}

/** One turn of the recap: the skill reads the conversation; when it is done, the questions are shared and a private note kept. */
export async function runRecapTurn(deps: AgentDeps, turn: RecapTurn): Promise<RecapResult> {
  const input: Record<string, unknown> = { messages: turn.messages, questionsLeft: turn.questionsLeft };
  if (turn.companySlug) input.company = turn.companySlug;
  const run = await orchestrate(deps, { skillId: "interview-recap", platform: "app", userId: turn.userId, input });
  if (run.status === "failed") throw new RecapFailed(run.error);

  const output = run.output as RecapOutput;
  if (!output.done) return { reply: output.reply, done: false };

  const company = await resolveCompany(deps.env, turn.companySlug, output.extracted.company);
  const extracted: RecapExtracted = { ...output.extracted, company: company?.name ?? output.extracted.company };
  const shared = company ? await share(deps.env, turn.userId, company.slug, extracted) : false;
  if (output.note) {
    await deps
      .memoryFor(turn.userId)
      .remember({ kind: "note", text: output.note })
      .catch((e: Error) => console.warn("recap note not saved", e.message));
  }
  // the model promised to share; when that could not happen, say what really happened instead
  const reply = shared ? output.reply : summaryReply({ ...extracted, questions: [] }, extracted.company);
  return { reply, done: true, extracted, shared };
}
