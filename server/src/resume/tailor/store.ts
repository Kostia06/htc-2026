import { db } from "../../db";
import type { Env } from "../../env";
import { decryptFor, encryptFor } from "../../memory/private/crypto";
import type { TailoredContent, TailoredListItem, TailoredResume } from "./types";

type Row = { id: string; ciphertext: string; iv: string; created_at: string; updated_at: string };

const COLUMNS = "id, ciphertext, iv, created_at, updated_at";
const MAX_LISTED = 50;

export const newTailoredId = () => `tr_${crypto.randomUUID()}`;

export async function saveTailored(env: Env, userId: string, content: TailoredContent, now = new Date()): Promise<TailoredResume> {
  const id = newTailoredId();
  const at = now.toISOString();
  const sealed = await encryptFor(env.MEMORY_SECRET, userId, JSON.stringify(content));
  await db(env).prepare(`INSERT INTO user_tailored_resumes (id, user_id, posting_id, ciphertext, iv, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, userId, content.postingId, sealed.ciphertext, sealed.iv, at, at)
    .run();
  return { ...content, id, createdAt: at, updatedAt: at };
}

// every query carries user_id, so an id alone never reaches someone else's version
export async function findTailored(env: Env, userId: string, id: string): Promise<TailoredResume | null> {
  const row = await db(env).prepare(`SELECT ${COLUMNS} FROM user_tailored_resumes WHERE id = ? AND user_id = ?`).bind(id, userId).first<Row>();
  return row ? decode(env, userId, row) : null;
}

export async function updateTailored(env: Env, userId: string, current: TailoredResume, content: TailoredContent, now = new Date()): Promise<TailoredResume> {
  const at = now.toISOString();
  const sealed = await encryptFor(env.MEMORY_SECRET, userId, JSON.stringify(content));
  await db(env).prepare("UPDATE user_tailored_resumes SET ciphertext = ?, iv = ?, updated_at = ? WHERE id = ? AND user_id = ?")
    .bind(sealed.ciphertext, sealed.iv, at, current.id, userId)
    .run();
  return { ...content, id: current.id, createdAt: current.createdAt, updatedAt: at };
}

export async function deleteTailored(env: Env, userId: string, id: string): Promise<boolean> {
  const result = await db(env).prepare("DELETE FROM user_tailored_resumes WHERE id = ? AND user_id = ?").bind(id, userId).run();
  return (result.meta.changes ?? 0) > 0;
}

export async function listTailored(env: Env, userId: string): Promise<TailoredListItem[]> {
  const { results } = await db(env).prepare(`SELECT ${COLUMNS} FROM user_tailored_resumes WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?`)
    .bind(userId, MAX_LISTED)
    .all<Row>();
  const versions = await Promise.all(results.map((row) => decode(env, userId, row)));
  return versions.map((v) => ({
    id: v.id,
    postingId: v.postingId,
    title: v.title,
    company: v.company,
    covered: v.match.covered.length,
    total: v.match.covered.length + v.match.missing.length,
    updatedAt: v.updatedAt,
  }));
}

async function decode(env: Env, userId: string, row: Row): Promise<TailoredResume> {
  const content = JSON.parse(await decryptFor(env.MEMORY_SECRET, userId, row)) as TailoredContent;
  return { ...content, id: row.id, createdAt: row.created_at, updatedAt: row.updated_at };
}
