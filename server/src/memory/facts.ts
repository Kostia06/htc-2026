import type { Env } from "../env";
import { sha256 } from "../lib/hash";
import { upsertVector } from "./vectors";

export type FactKind = "about" | "hiring" | "interview" | "tech" | "news";
export type NewFact = { kind: FactKind; text: string; source_url: string };

export const deps = { upsertVector };

export async function saveFact(env: Env, companyId: string, fact: NewFact) {
  const hash = await sha256(`${fact.kind}:${fact.text.trim().toLowerCase()}`);
  const id = crypto.randomUUID();
  const res = await env.DB.prepare(
    "INSERT OR IGNORE INTO company_facts (id, company_id, kind, text, source_url, fetched_at, content_hash) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(id, companyId, fact.kind, fact.text.trim(), fact.source_url, new Date().toISOString(), hash)
    .run();
  if (!res.meta.changes) return { saved: false, reason: "duplicate" } as const;
  await deps.upsertVector(env, `fact:${id}`, fact.text, { company_id: companyId, kind: "fact" });
  return { saved: true } as const;
}
