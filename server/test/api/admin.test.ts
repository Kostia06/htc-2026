import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type { Env } from "../../src/env";
import app from "../../src/index";
import { deps } from "../../src/memory/reembed";

// Vectorize is remote-only, so the fake records what the route would have written
function fakeVectors() {
  const upserted: { id: string; metadata?: Record<string, string> }[] = [];
  const index = { upsert: async (items: typeof upserted) => void upserted.push(...items) } as unknown as VectorizeIndex;
  return { index, upserted };
}

const post = (path: string, headers: Record<string, string>, testEnv: Env) => app.request(path, { method: "POST", headers }, testEnv);

describe("POST /admin/reembed-vectors", () => {
  beforeEach(() => {
    deps.embed = async () => [0.1, 0.2];
  });

  it("does not exist without ADMIN_SECRET and rejects a wrong bearer", async () => {
    expect((await post("/admin/reembed-vectors", {}, env)).status).toBe(404);
    expect((await post("/admin/reembed-vectors", { Authorization: "Bearer nope" }, { ...env, ADMIN_SECRET: "s3cret" })).status).toBe(401);
  });

  it("re-embeds every fact and experience into the active vector store", async () => {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO companies (id, slug, name) VALUES ('c1', 'acme', 'Acme')"),
      env.DB.prepare("INSERT INTO company_facts (id, company_id, kind, text, source_url, fetched_at, content_hash) VALUES ('f1', 'c1', 'about', 'anvils', 'u', '2026', 'h1')"),
      env.DB.prepare("INSERT INTO experiences (id, company_id, role, questions_json, created_at) VALUES ('e1', 'c1', 'Analyst', '[\"Why us\"]', '2026')"),
    ]);
    const { index, upserted } = fakeVectors();
    const res = await post("/admin/reembed-vectors?limit=50", { Authorization: "Bearer s3cret" }, { ...env, ADMIN_SECRET: "s3cret", VECTORS: index });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ embedded: 2, next: null });
    expect(upserted.map((v) => [v.id, v.metadata?.kind]).sort()).toEqual([
      ["exp:e1", "exp"],
      ["fact:f1", "fact"],
    ]);
  });
});
