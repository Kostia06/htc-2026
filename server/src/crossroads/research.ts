import { db } from "../db";
import type { Env } from "../env";
import type { Lane } from "./lanes";

const MAX_COMPANIES = 6;
const FACTS_PER_COMPANY = 2;
const DAY_MS = 86_400_000;

/** One researched fact, always with where it came from and how old it is, so the person can check it themselves. */
export type ResearchFact = {
  id: string;
  company: string;
  slug: string;
  kind: string;
  text: string;
  sourceUrl: string;
  sourceHost: string;
  fetchedAt: string;
  ageDays: number;
};

type Row = { id: string; name: string; slug: string; kind: string; text: string; source_url: string; fetched_at: string };

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

// employers the person saved postings from come first: those are the ones they are actually heading for
async function companiesFor(env: Env, userId: string, lane: Lane): Promise<string[]> {
  const { results } = await db(env).prepare(
    `SELECT c.id, max(CASE WHEN p.user_id IS NULL THEN 0 ELSE 1 END) AS saved, c.last_researched_at
     FROM companies c LEFT JOIN user_postings p ON p.company_slug = c.slug AND p.user_id = ?
     WHERE (p.user_id IS NOT NULL OR c.lane = ?) AND EXISTS (SELECT 1 FROM company_facts f WHERE f.company_id = c.id)
     GROUP BY c.id, c.last_researched_at
     ORDER BY saved DESC, c.last_researched_at DESC LIMIT ?`,
  )
    .bind(userId, lane, MAX_COMPANIES)
    .all<{ id: string }>();
  return results.map((r) => r.id);
}

export async function researchFor(env: Env, userId: string, lane: Lane, now = Date.now()): Promise<ResearchFact[]> {
  const ids = await companiesFor(env, userId, lane);
  const facts: ResearchFact[] = [];
  for (const id of ids) {
    const { results } = await db(env).prepare(
      `SELECT f.id, c.name, c.slug, f.kind, f.text, f.source_url, f.fetched_at FROM company_facts f JOIN companies c ON c.id = f.company_id
       WHERE f.company_id = ? AND f.kind IN ('hiring', 'interview', 'interview_process', 'about') ORDER BY f.fetched_at DESC LIMIT ?`,
    )
      .bind(id, FACTS_PER_COMPANY)
      .all<Row>();
    for (const row of results) {
      facts.push({
        id: row.id,
        company: row.name,
        slug: row.slug,
        kind: row.kind,
        text: row.text,
        sourceUrl: row.source_url,
        sourceHost: hostOf(row.source_url),
        fetchedAt: row.fetched_at,
        ageDays: Math.max(0, Math.floor((now - Date.parse(row.fetched_at)) / DAY_MS)),
      });
    }
  }
  return facts;
}
