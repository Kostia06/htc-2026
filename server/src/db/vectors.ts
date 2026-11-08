import type { Env } from "../env";
import { backend, db } from "./index";
import type { Database } from "./types";

// the slice of Vectorize our code uses, so the same memory code runs on Vectorize or pgvector
export type VectorMetadata = Record<string, string>;
export type VectorMatch = { id: string; score: number };
export type VectorStore = {
  upsert(items: { id: string; values: number[]; metadata?: VectorMetadata }[]): Promise<void>;
  query(values: number[], options: { topK: number; filter?: VectorMetadata }): Promise<{ matches: VectorMatch[] }>;
  deleteByIds(ids: string[]): Promise<void>;
};

// same DB_BACKEND switch as the tables: vectors live next to the rows they describe
export function vectors(env: Env): VectorStore {
  return backend(env) === "postgres" ? pgvectorStore(db(env)) : vectorizeStore(env.VECTORS);
}

export function vectorizeStore(index: VectorizeIndex): VectorStore {
  return {
    upsert: async (items) => {
      await index.upsert(items);
    },
    query: async (values, { topK, filter }) => {
      const { matches } = await index.query(values, { topK, filter });
      return { matches: matches.map((m) => ({ id: m.id, score: m.score })) };
    },
    deleteByIds: async (ids) => {
      await index.deleteByIds(ids);
    },
  };
}

const asVector = (values: number[]) => `[${values.join(",")}]`;

// table memory_vectors from the Supabase schema; the score is cosine similarity, like a cosine Vectorize index
export function pgvectorStore(database: Database): VectorStore {
  return {
    upsert: async (items) => {
      if (items.length === 0) return;
      const upsert = database.prepare(
        `INSERT INTO memory_vectors (id, embedding, metadata) VALUES (?, ?::vector, ?::jsonb)
         ON CONFLICT (id) DO UPDATE SET embedding = excluded.embedding, metadata = excluded.metadata`,
      );
      await database.batch(items.map((item) => upsert.bind(item.id, asVector(item.values), JSON.stringify(item.metadata ?? {}))));
    },
    query: async (values, { topK, filter }) => {
      const { results } = await database
        .prepare(
          `SELECT id, 1 - (embedding <=> ?1::vector) AS score FROM memory_vectors
           WHERE metadata @> ?2::jsonb ORDER BY embedding <=> ?1::vector LIMIT ?3`,
        )
        .bind(asVector(values), JSON.stringify(filter ?? {}), topK)
        .all<VectorMatch>();
      return { matches: results.map((r) => ({ id: r.id, score: Number(r.score) })) };
    },
    deleteByIds: async (ids) => {
      if (ids.length === 0) return;
      await database
        .prepare(`DELETE FROM memory_vectors WHERE id IN (${ids.map(() => "?").join(", ")})`)
        .bind(...ids)
        .run();
    },
  };
}
