import type { Env } from "../env";
import { decryptFor, encryptFor } from "../memory/private/crypto";
import { getProfile } from "../memory/profile/store";
import { seedFromProfile } from "./parse";
import type { Resume } from "./types";

type ResumeRow = { ciphertext: string; iv: string };

export async function getResume(env: Env, userId: string): Promise<Resume | null> {
  const row = await env.DB.prepare("SELECT ciphertext, iv FROM user_resumes WHERE user_id = ?").bind(userId).first<ResumeRow>();
  if (!row) return null;
  return JSON.parse(await decryptFor(env.MEMORY_SECRET, userId, row));
}

// the seed is not written: the profile may still change before the person first saves, and GET must stay a read
export async function loadResume(env: Env, userId: string): Promise<{ resume: Resume; saved: boolean }> {
  const stored = await getResume(env, userId);
  if (stored) return { resume: stored, saved: true };
  return { resume: seedFromProfile(await getProfile(env, userId)), saved: false };
}

export async function putResume(env: Env, userId: string, resume: Resume): Promise<Resume> {
  const next: Resume = { ...resume, updatedAt: new Date().toISOString() };
  const sealed = await encryptFor(env.MEMORY_SECRET, userId, JSON.stringify(next));
  await env.DB.prepare(
    `INSERT INTO user_resumes (user_id, ciphertext, iv, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET ciphertext = excluded.ciphertext, iv = excluded.iv, updated_at = excluded.updated_at`,
  )
    .bind(userId, sealed.ciphertext, sealed.iv, next.updatedAt)
    .run();
  return next;
}
