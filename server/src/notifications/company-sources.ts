import { db } from "../db";
import type { Env } from "../env";
import { clip, DAY_MS } from "./rules";
import type { Candidate } from "./types";

// shared knowledge is only news while it is new; older rows were there when the person last looked
const FRESH_MS = 7 * DAY_MS;
const PER_SOURCE = 3;
const NEWS_KINDS = ["news", "hiring", "interview", "interview_process"];

type Company = { id: string; slug: string; name: string };

/** The companies someone is going for: the ones on postings they imported and the ones they practised for. */
export async function targetCompanies(env: Env, userId: string): Promise<Company[]> {
  const { results } = await db(env).prepare(
    `SELECT id, slug, name FROM companies WHERE slug IN (
       SELECT company_slug FROM user_postings WHERE user_id = ?1 AND company_slug IS NOT NULL
       UNION SELECT company_slug FROM voice_sessions WHERE user_id = ?1 AND company_slug IS NOT NULL)
     ORDER BY name LIMIT 20`,
  )
    .bind(userId)
    .all<Company>();
  return results;
}

// one line per company per run, so a burst of research on one employer can't fill the whole day's cap
function onePerCompany(candidates: Candidate[]) {
  const seen = new Set<string>();
  return candidates.filter((c) => {
    const slug = c.target.type === "company" ? c.target.slug : c.key;
    if (seen.has(slug)) return false;
    seen.add(slug);
    return true;
  });
}

const placeholders = (n: number) => Array.from({ length: n }, () => "?").join(", ");

const firstQuestion = (json: string) => {
  try {
    const value = JSON.parse(json) as unknown;
    return Array.isArray(value) && typeof value[0] === "string" ? value[0] : null;
  } catch {
    return null;
  }
};

type ExperienceRow = { id: string; company_id: string; role: string; questions_json: string };

export async function reportedQuestions(env: Env, companies: Company[], now: Date): Promise<Candidate[]> {
  if (companies.length === 0) return [];
  const { results } = await db(env).prepare(
    `SELECT id, company_id, role, questions_json FROM experiences
     WHERE is_seeded = 0 AND created_at > ? AND company_id IN (${placeholders(companies.length)}) ORDER BY created_at DESC LIMIT ?`,
  )
    .bind(new Date(now.getTime() - FRESH_MS).toISOString(), ...companies.map((c) => c.id), PER_SOURCE)
    .all<ExperienceRow>();
  const byId = new Map(companies.map((c) => [c.id, c]));
  const all = results.flatMap((row) => {
    const company = byId.get(row.company_id);
    if (!company) return [];
    const question = firstQuestion(row.questions_json);
    const body = question ? `${row.role}: “${question}”` : `Someone interviewed for ${row.role} and shared what came up.`;
    const candidate: Candidate = { kind: "interview_question", key: `exp:${row.id}`, title: clip(`New interview question at ${company.name}`, 80), body: clip(body, 120), target: { type: "company", slug: company.slug } };
    return [candidate];
  });
  return onePerCompany(all);
}

type FactRow = { id: string; company_id: string; text: string };

export async function freshResearch(env: Env, companies: Company[], now: Date): Promise<Candidate[]> {
  if (companies.length === 0) return [];
  const { results } = await db(env).prepare(
    `SELECT id, company_id, text FROM company_facts
     WHERE fetched_at > ? AND kind IN (${placeholders(NEWS_KINDS.length)}) AND company_id IN (${placeholders(companies.length)})
     ORDER BY fetched_at DESC LIMIT ?`,
  )
    .bind(new Date(now.getTime() - FRESH_MS).toISOString(), ...NEWS_KINDS, ...companies.map((c) => c.id), PER_SOURCE)
    .all<FactRow>();
  const byId = new Map(companies.map((c) => [c.id, c]));
  const all = results.flatMap((row) => {
    const company = byId.get(row.company_id);
    if (!company) return [];
    const candidate: Candidate = { kind: "company_news", key: `fact:${row.id}`, title: clip(`New on ${company.name}`, 80), body: clip(row.text, 120), target: { type: "company", slug: company.slug } };
    return [candidate];
  });
  return onePerCompany(all);
}
