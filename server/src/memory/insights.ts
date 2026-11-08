import { db } from "../db";
import type { Env } from "../env";

// one person's report must never be identifiable, so real reports stay hidden below this count
export const MIN_REPORTS = 3;

// a report from three months ago counts half as much as one from today, so prep follows what is asked now
const HALF_LIFE_DAYS = 90;
const DAY_MS = 86_400_000;

type Fact = { kind: string; text: string; source_url: string; fetched_at: string };
type ExpRow = { questions_json: string; is_seeded: number; created_at: string };
type Question = { text: string; count: number; example: boolean; last_reported_at: string | null };
type Tally = Question & { weight: number };

const recencyWeight = (createdAt: string, now: number) => 0.5 ** (Math.max(0, now - Date.parse(createdAt)) / DAY_MS / HALF_LIFE_DAYS);

// seeded examples were never reported by anyone, so they carry no date and no recency
function tally(rows: ExpRow[], example: boolean, now: number): Tally[] {
  const tallies = new Map<string, Tally>();
  for (const row of rows) {
    for (const q of JSON.parse(row.questions_json) as string[]) {
      const key = q.trim().toLowerCase();
      const entry = tallies.get(key) ?? { text: q.trim(), count: 0, example, last_reported_at: null, weight: 0 };
      entry.count++;
      if (!example) {
        entry.weight += recencyWeight(row.created_at, now);
        if (!entry.last_reported_at || row.created_at > entry.last_reported_at) entry.last_reported_at = row.created_at;
      }
      tallies.set(key, entry);
    }
  }
  return [...tallies.values()];
}

// month only: an exact timestamp next to a question could point back at the one person who reported it
const reportedMonth = (createdAt: string | null) => createdAt?.slice(0, 7) ?? null;

const byRank = (a: Tally, b: Tally) => Number(a.example) - Number(b.example) || b.weight - a.weight || b.count - a.count;
const forDisplay = ({ weight: _, ...question }: Tally): Question => ({ ...question, last_reported_at: reportedMonth(question.last_reported_at) });

export async function getCompanyInsights(env: Env, slug: string, role?: string) {
  const company = await db(env).prepare("SELECT id, slug, name, website, last_researched_at FROM companies WHERE slug = ?")
    .bind(slug)
    .first<{ id: string; slug: string; name: string; website: string | null; last_researched_at: string | null }>();
  if (!company) return null;

  const { results: facts } = await db(env).prepare(
    "SELECT kind, text, source_url, fetched_at FROM company_facts WHERE company_id = ? ORDER BY fetched_at DESC LIMIT 30",
  )
    .bind(company.id)
    .all<Fact>();

  const roleFilter = role ? " AND lower(role) = lower(?)" : "";
  const stmt = db(env).prepare(`SELECT questions_json, is_seeded, created_at FROM experiences WHERE company_id = ?${roleFilter}`);
  const { results: rows } = await (role ? stmt.bind(company.id, role) : stmt.bind(company.id)).all<ExpRow>();

  const real = rows.filter((r) => !r.is_seeded);
  const seeded = rows.filter((r) => r.is_seeded);
  // free-text tips and formats are never returned: they're one person's words, easy to recognise
  const now = Date.now();
  const questions = [...(real.length >= MIN_REPORTS ? tally(real, false, now) : []), ...tally(seeded, true, now)].sort(byRank).map(forDisplay);

  return { company, facts, reportCount: real.length, questions };
}
