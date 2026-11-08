import { db } from "../db";
import { vectors } from "../db/vectors";
import type { Env } from "../env";
import { embed } from "../integrations/workers-ai";

// Vectorize can't export vector values, so after the data copy the index on the new backend is rebuilt from the
// text that is still in the tables: the same ids and metadata saveFact and submitExperience write.
type FactRow = { id: string; company_id: string; text: string };
type ExperienceRow = { id: string; company_id: string; role: string; questions_json: string };

export const deps = { embed };

export async function reembedVectors(env: Env, page: { offset: number; limit: number }) {
  const database = db(env);
  const store = vectors(env);
  const [facts, experiences] = await database.batch([
    database.prepare("SELECT id, company_id, text FROM company_facts ORDER BY id LIMIT ? OFFSET ?").bind(page.limit, page.offset),
    database.prepare("SELECT id, company_id, role, questions_json FROM experiences ORDER BY id LIMIT ? OFFSET ?").bind(page.limit, page.offset),
  ]);
  const items = [
    ...(facts.results as FactRow[]).map((f) => ({ id: `fact:${f.id}`, text: f.text, metadata: { company_id: f.company_id, kind: "fact" } })),
    ...(experiences.results as ExperienceRow[]).map((e) => ({
      id: `exp:${e.id}`,
      text: `${e.role}: ${(JSON.parse(e.questions_json) as string[]).join(" | ")}`,
      metadata: { company_id: e.company_id, kind: "exp" },
    })),
  ];
  for (const item of items) {
    await store.upsert([{ id: item.id, values: await deps.embed(env, item.text), metadata: item.metadata }]);
  }
  const more = facts.results.length === page.limit || experiences.results.length === page.limit;
  return { embedded: items.length, next: more ? page.offset + page.limit : null };
}
