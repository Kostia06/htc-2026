import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { deleteDocument, readDocument, saveDocument, deleteExpiredDocuments } from "../../src/documents/store";

const doc = { name: "resume.pdf", format: "pdf" as const, text: "Built a Python Flask API" };

describe("document store", () => {
  it("returns a document only to the person who uploaded it", async () => {
    const id = await saveDocument(env, "owner", doc);
    expect(await readDocument(env, "owner", id)).toMatchObject(doc);
    expect(await readDocument(env, "someone-else", id)).toBeNull();
  });

  it("keeps only ciphertext at rest", async () => {
    const id = await saveDocument(env, "owner", doc);
    const row = await env.DB.prepare("SELECT ciphertext FROM user_documents WHERE id = ?").bind(id).first<{ ciphertext: string }>();
    expect(row?.ciphertext).not.toContain("Flask");
  });

  it("expires after an hour and is deleted on request", async () => {
    const now = new Date("2026-11-07T12:00:00Z");
    const id = await saveDocument(env, "owner", doc, now);
    expect(await readDocument(env, "owner", id, new Date("2026-11-07T13:01:00Z"))).toBeNull();
    expect(await deleteExpiredDocuments(env, new Date("2026-11-07T13:01:00Z"))).toBeGreaterThanOrEqual(1);
    const second = await saveDocument(env, "owner", doc);
    expect(await deleteDocument(env, "owner", second)).toBe(true);
    expect(await readDocument(env, "owner", second)).toBeNull();
  });
});
