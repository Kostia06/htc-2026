import { db } from "../db";
import type { Env } from "../env";
import { decryptFor, encryptFor } from "../memory/private/crypto";
import type { Posting, PostingContent } from "./types";

type Row = { id: string; ciphertext: string; iv: string; created_at: string };

const COLUMNS = "id, ciphertext, iv, created_at";
const MAX_LISTED = 50;

// minted before the save, so the roadmap step written during prefill can already point at the posting
export const newPostingId = () => `po_${crypto.randomUUID()}`;

export async function savePosting(env: Env, userId: string, id: string, content: PostingContent, now = new Date()): Promise<Posting> {
  const sealed = await encryptFor(env.MEMORY_SECRET, userId, JSON.stringify(content));
  await db(env).prepare("INSERT INTO user_postings (id, user_id, company_slug, ciphertext, iv, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, userId, content.companySlug, sealed.ciphertext, sealed.iv, now.toISOString())
    .run();
  return { ...content, id, createdAt: now.toISOString() };
}

// every query carries user_id, so a posting id alone never reaches someone else's posting
export async function findPosting(env: Env, userId: string, id: string): Promise<Posting | null> {
  const row = await db(env).prepare(`SELECT ${COLUMNS} FROM user_postings WHERE id = ? AND user_id = ?`).bind(id, userId).first<Row>();
  return row ? decode(env, userId, row) : null;
}

export async function listPostings(env: Env, userId: string): Promise<Posting[]> {
  const { results } = await db(env).prepare(`SELECT ${COLUMNS} FROM user_postings WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`)
    .bind(userId, MAX_LISTED)
    .all<Row>();
  return Promise.all(results.map((row) => decode(env, userId, row)));
}

async function decode(env: Env, userId: string, row: Row): Promise<Posting> {
  const content = JSON.parse(await decryptFor(env.MEMORY_SECRET, userId, row)) as PostingContent;
  return { ...content, id: row.id, createdAt: row.created_at };
}
