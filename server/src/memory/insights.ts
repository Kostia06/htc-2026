import type { Env } from "../env";

// one person's report must never be identifiable, so real reports stay hidden below this count
export const MIN_REPORTS = 3;

type Fact = { kind: string; text: string; source_url: string; fetched_at: string };
type ExpRow = { questions_json: string; is_seeded: number };
type Question = { text: string; count: number; example: boolean };

function tally(rows: ExpRow[], example: boolean): Question[] {
  const counts = new Map<string, Question>();
  for (const row of rows) {
    for (const q of JSON.parse(row.questions_json) as string[]) {
      const key = q.trim().toLowerCase();
      const entry = counts.get(key) ?? { text: q.trim(), count: 0, example };
      entry.count++;
      counts.set(key, entry);
    }
  }
  return [...counts.values()];
}

export async function getCompanyInsights(env: Env, slug: string, role?: string) {
  const company = await env.DB.prepare("SELECT id, slug, name, website, last_researched_at FROM companies WHERE slug = ?")
    .bind(slug)
    .first<{ id: string; slug: string; name: string; website: string | null; last_researched_at: string | null }>();
  if (!company) return null;

  const { results: facts } = await env.DB.prepare(
    "SELECT kind, text, source_url, fetched_at FROM company_facts WHERE company_id = ? ORDER BY fetched_at DESC LIMIT 30",
  )
    .bind(company.id)
    .all<Fact>();

  const roleFilter = role ? " AND lower(role) = lower(?)" : "";
  const stmt = env.DB.prepare(`SELECT questions_json, is_seeded FROM experiences WHERE company_id = ?${roleFilter}`);
  const { results: rows } = await (role ? stmt.bind(company.id, role) : stmt.bind(company.id)).all<ExpRow>();

  const real = rows.filter((r) => !r.is_seeded);
  const seeded = rows.filter((r) => r.is_seeded);
  // free-text tips and formats are never returned: they're one person's words, easy to recognise
  const questions = [...(real.length >= MIN_REPORTS ? tally(real, false) : []), ...tally(seeded, true)].sort(
    (a, b) => Number(a.example) - Number(b.example) || b.count - a.count,
  );

  return { company, facts, reportCount: real.length, questions };
}
