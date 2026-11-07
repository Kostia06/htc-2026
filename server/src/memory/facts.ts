import type { Env } from "../env";
import { sha256 } from "../lib/hash";
import { upsertVector } from "./vectors";

export type FactKind = "about" | "hiring" | "interview" | "tech" | "news";
export type NewFact = { kind: FactKind; text: string; source_url: string };

export const deps = { upsertVector };

export async function saveFact(env: Env, companyId: string, fact: NewFact) {
  const hash = await sha256(`${fact.kind}:${fact.text.trim().toLowerCase()}`);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const res = await env.DB.prepare(
    "INSERT OR IGNORE INTO company_facts (id, company_id, kind, text, source_url, fetched_at, content_hash) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(id, companyId, fact.kind, fact.text.trim(), fact.source_url, now, hash)
    .run();
  if (!res.meta.changes) {
    // seeing the fact again re-verifies it, which keeps it clear of garbage collection
    await env.DB.prepare("UPDATE company_facts SET fetched_at = ? WHERE content_hash = ?").bind(now, hash).run();
    return { saved: false, reason: "duplicate" } as const;
  }
  await deps.upsertVector(env, `fact:${id}`, fact.text, { company_id: companyId, kind: "fact" });
  return { saved: true } as const;
}
