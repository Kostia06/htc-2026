import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { vectors } from "../src/db/vectors";
import type { Env } from "../src/env";
import { memorySearch } from "../src/memory/search";
import { upsertVector } from "../src/memory/vectors";
import { reembedVectors, deps as reembedDeps } from "../src/memory/reembed";
import { openTestDatabase } from "./pglite";

let db: Awaited<ReturnType<typeof openTestDatabase>>;
let env: Env;

// 768 dims with the signal in the first two, so similarity is easy to reason about
const vec = (x: number, y: number) => [x, y, ...new Array(766).fill(0)];
const fakeAi = (answer: number[]) => ({ run: async () => ({ data: [answer] }) }) as unknown as Ai;

beforeAll(async () => {
  db = await openTestDatabase();
  env = db.env;
});
afterAll(() => db.pg.close());
beforeEach(() => db.pg.exec("DELETE FROM memory_vectors; DELETE FROM company_facts; DELETE FROM experiences; DELETE FROM companies"));

describe("pgvector store", () => {
  it("upserts, ranks by cosine similarity within the metadata filter, and deletes by id", async () => {
    const store = vectors(env);
    await store.upsert([
      { id: "fact:1", values: vec(1, 0), metadata: { company_id: "c1", kind: "fact" } },
      { id: "fact:2", values: vec(0.7, 0.7), metadata: { company_id: "c1", kind: "fact" } },
      { id: "fact:3", values: vec(1, 0), metadata: { company_id: "c2", kind: "fact" } },
      { id: "exp:1", values: vec(1, 0), metadata: { company_id: "c1", kind: "exp" } },
    ]);
    const { matches } = await store.query(vec(1, 0), { topK: 8, filter: { company_id: "c1", kind: "fact" } });
    expect(matches.map((m) => m.id)).toEqual(["fact:1", "fact:2"]);
    expect(matches[0].score).toBeCloseTo(1, 5);
    expect(matches[1].score).toBeCloseTo(Math.SQRT1_2, 5);

    // same id again replaces the vector
    await store.upsert([{ id: "fact:2", values: vec(1, 0), metadata: { company_id: "c1", kind: "fact" } }]);
    expect((await store.query(vec(1, 0), { topK: 1, filter: { company_id: "c1", kind: "fact" } })).matches[0].score).toBeCloseTo(1, 5);

    await store.deleteByIds(["fact:1", "fact:2"]);
    expect((await store.query(vec(1, 0), { topK: 8, filter: { company_id: "c1" } })).matches.map((m) => m.id)).toEqual(["exp:1"]);
  });

  it("serves memorySearch end to end: embed, match, join the fact rows", async () => {
    await db.pg.exec("INSERT INTO companies (id, slug, name) VALUES ('c1', 'acme', 'Acme')");
    await db.pg.exec("INSERT INTO company_facts (id, company_id, kind, text, source_url, fetched_at, content_hash) VALUES ('f1', 'c1', 'tech', 'Acme runs on Postgres', 'https://acme.com', '2026', 'h1')");
    const withAi = { ...env, AI: fakeAi(vec(0, 1)) };
    await upsertVector(withAi, "fact:f1", "Acme runs on Postgres", { company_id: "c1", kind: "fact" });
    const hits = await memorySearch(withAi, "c1", "database");
    expect(hits).toEqual([{ kind: "tech", text: "Acme runs on Postgres", source_url: "https://acme.com", score: expect.closeTo(1, 5) }]);
    expect(await memorySearch(withAi, "c2", "database")).toEqual([]);
  });
});

describe("reembedVectors", () => {
  it("rebuilds fact and experience vectors from the tables, in pages", async () => {
    await db.pg.exec("INSERT INTO companies (id, slug, name) VALUES ('c1', 'acme', 'Acme')");
    await db.pg.exec(`INSERT INTO company_facts (id, company_id, kind, text, source_url, fetched_at, content_hash) VALUES
      ('f1', 'c1', 'about', 'one', 'u', '2026', 'h1'), ('f2', 'c1', 'about', 'two', 'u', '2026', 'h2')`);
    await db.pg.exec("INSERT INTO experiences (id, company_id, role, questions_json, created_at) VALUES ('e1', 'c1', 'Analyst', '[\"Why us?\"]', '2026')");
    const embedded: string[] = [];
    reembedDeps.embed = async (_env, text) => {
      embedded.push(text);
      return vec(1, 0);
    };
    expect(await reembedVectors(env, { offset: 0, limit: 1 })).toEqual({ embedded: 2, next: 1 });
    // a full page means there may be more; the page after it is empty and ends the walk
    expect(await reembedVectors(env, { offset: 1, limit: 1 })).toEqual({ embedded: 1, next: 2 });
    expect(await reembedVectors(env, { offset: 2, limit: 1 })).toEqual({ embedded: 0, next: null });
    expect(embedded.sort()).toEqual(["Analyst: Why us?", "one", "two"]);
    const { rows } = await db.pg.query<{ id: string; metadata: { kind: string } }>("SELECT id, metadata FROM memory_vectors ORDER BY id");
    expect(rows.map((r) => [r.id, r.metadata.kind])).toEqual([
      ["exp:e1", "exp"],
      ["fact:f1", "fact"],
      ["fact:f2", "fact"],
    ]);
  });
});
