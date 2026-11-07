import { Hono } from "hono";
import type { AppContext, Env } from "../env";

// one person's report must never be identifiable, so nothing from experiences shows below this
export const MIN_REPORTS = 3;

type Fact = { kind: string; text: string; source_url: string; fetched_at: string };
type ExpRow = { role: string; questions_json: string; format: string | null; tips: string | null; is_seeded: number };

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
  const stmt = env.DB.prepare(`SELECT role, questions_json, format, tips, is_seeded FROM experiences WHERE company_id = ?${roleFilter}`);
  const { results: rows } = await (role ? stmt.bind(company.id, role) : stmt.bind(company.id)).all<ExpRow>();

  const reportCount = rows.length;
  if (reportCount < MIN_REPORTS) {
    return { company, facts, reportCount, questions: [], formats: [], tips: [] };
  }

  const tally = new Map<string, { text: string; count: number; real: number }>();
  for (const row of rows) {
    for (const q of JSON.parse(row.questions_json) as string[]) {
      const key = q.trim().toLowerCase();
      const entry = tally.get(key) ?? { text: q.trim(), count: 0, real: 0 };
      entry.count++;
      if (!row.is_seeded) entry.real++;
      tally.set(key, entry);
    }
  }
  const questions = [...tally.values()]
    .sort((a, b) => b.count - a.count)
    .map((q) => ({ text: q.text, count: q.count, example: q.real === 0 }));
  const unique = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x?.trim()))];

  return { company, facts, reportCount, questions, formats: unique(rows.map((r) => r.format)), tips: unique(rows.map((r) => r.tips)) };
}

export const memory = new Hono<AppContext>();

memory.get("/:slug", async (c) => {
  const insights = await getCompanyInsights(c.env, c.req.param("slug"), c.req.query("role"));
  return insights ? c.json(insights) : c.json({ error: "unknown company" }, 404);
});
