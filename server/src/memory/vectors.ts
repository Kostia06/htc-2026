import { embed } from "../integrations/workers-ai";
import type { Env } from "../env";

export type VectorMeta = { company_id: string; kind: "fact" | "exp" };

export async function upsertVector(env: Env, id: string, text: string, meta: VectorMeta) {
  await env.VECTORS.upsert([{ id, values: await embed(env, text), metadata: meta }]);
}
