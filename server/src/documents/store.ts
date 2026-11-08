import { db } from "../db";
import type { Env } from "../env";
import { decryptFor, encryptFor } from "../memory/private/crypto";
import type { DocumentFormat } from "./formats";

export type StoredDocument = { name: string; format: DocumentFormat; text: string };

// long enough to review the prefilled profile, short enough that a resume never lingers
const LIFETIME_MS = 60 * 60 * 1000;

type DocumentRow = { ciphertext: string; iv: string };

export async function saveDocument(env: Env, userId: string, doc: StoredDocument, now = new Date()): Promise<string> {
  const id = crypto.randomUUID();
  const sealed = await encryptFor(env.MEMORY_SECRET, userId, JSON.stringify(doc));
  await db(env).prepare("INSERT INTO user_documents (id, user_id, ciphertext, iv, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, userId, sealed.ciphertext, sealed.iv, now.toISOString(), new Date(now.getTime() + LIFETIME_MS).toISOString())
    .run();
  return id;
}

export async function readDocument(env: Env, userId: string, id: string, now = new Date()): Promise<StoredDocument | null> {
  const row = await db(env).prepare("SELECT ciphertext, iv FROM user_documents WHERE id = ? AND user_id = ? AND expires_at > ?")
    .bind(id, userId, now.toISOString())
    .first<DocumentRow>();
  if (!row) return null;
  return JSON.parse(await decryptFor(env.MEMORY_SECRET, userId, row));
}

export async function deleteDocument(env: Env, userId: string, id: string): Promise<boolean> {
  const result = await db(env).prepare("DELETE FROM user_documents WHERE id = ? AND user_id = ?").bind(id, userId).run();
  return result.meta.changes > 0;
}

export async function deleteExpiredDocuments(env: Env, now = new Date()): Promise<number> {
  const result = await db(env).prepare("DELETE FROM user_documents WHERE expires_at <= ?").bind(now.toISOString()).run();
  return result.meta.changes;
}
