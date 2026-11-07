import { embed } from "../integrations/workers-ai";
import type { CompanyFactHit } from "../agents/core/types";
import type { Env } from "../env";

export async function memorySearch(env: Env, companyId: string, query: string): Promise<CompanyFactHit[]> {
  const { matches } = await env.VECTORS.query(await embed(env, query), {
    topK: 8,
    filter: { company_id: companyId, kind: "fact" },
  });
  const ids = matches.map((m) => m.id.replace(/^fact:/, ""));
  if (ids.length === 0) return [];
  const { results } = await env.DB.prepare(
    `SELECT id, kind, text, source_url FROM company_facts WHERE id IN (${ids.map(() => "?").join(",")})`,
  )
    .bind(...ids)
    .all<{ id: string; kind: string; text: string; source_url: string }>();
  const score = new Map(matches.map((m) => [m.id.replace(/^fact:/, ""), m.score]));
  return results.map((r) => ({ kind: r.kind, text: r.text, source_url: r.source_url, score: score.get(r.id) ?? 0 }));
}
