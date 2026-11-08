import { Hono } from "hono";
import type { AppContext } from "../env";

type CompanyRow = { slug: string; name: string; fact_count: number; reported_count: number; last_researched_at: string | null };

export const companies = new Hono<AppContext>();

// every researched company, freshest research first; counts only, the facts themselves come from /api/memory/:slug
companies.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT c.slug, c.name, c.last_researched_at,
       (SELECT COUNT(*) FROM company_facts f WHERE f.company_id = c.id) AS fact_count,
       (SELECT COUNT(*) FROM experiences e WHERE e.company_id = c.id AND e.is_seeded = 0) AS reported_count
     FROM companies c
     ORDER BY c.last_researched_at IS NULL, c.last_researched_at DESC, c.name`,
  ).all<CompanyRow>();
  return c.json({
    companies: results.map((row) => ({
      slug: row.slug,
      name: row.name,
      factCount: row.fact_count,
      reportedCount: row.reported_count,
      lastResearchedAt: row.last_researched_at,
    })),
  });
});
