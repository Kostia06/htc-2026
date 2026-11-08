import { db } from "../db";
import type { Env } from "../env";
import { decryptFor, encryptFor } from "../memory/private/crypto";
import { getProfile } from "../memory/profile/store";
import type { Account } from "../auth/account";
import { prefillResume } from "./prefill";
import { emptyResume, type Resume } from "./types";

type ResumeRow = { ciphertext: string; iv: string };

export async function getResume(env: Env, userId: string): Promise<Resume | null> {
  const row = await db(env).prepare("SELECT ciphertext, iv FROM user_resumes WHERE user_id = ?").bind(userId).first<ResumeRow>();
  if (!row) return null;
  const stored = JSON.parse(await decryptFor(env.MEMORY_SECRET, userId, row)) as Resume;
  // resumes saved before contact had a location
  return { ...stored, contact: { ...emptyResume().contact, ...stored.contact } };
}

// blanks are filled on every read and never written: the profile may still change, and GET must stay a read
export async function loadResume(env: Env, userId: string, account?: Account): Promise<{ resume: Resume; saved: boolean }> {
  const [stored, profile] = await Promise.all([getResume(env, userId), getProfile(env, userId)]);
  return { resume: prefillResume(stored ?? emptyResume(), profile, account), saved: stored !== null };
}

export async function putResume(env: Env, userId: string, resume: Resume): Promise<Resume> {
  const next: Resume = { ...resume, updatedAt: new Date().toISOString() };
  const sealed = await encryptFor(env.MEMORY_SECRET, userId, JSON.stringify(next));
  await db(env).prepare(
    `INSERT INTO user_resumes (user_id, ciphertext, iv, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET ciphertext = excluded.ciphertext, iv = excluded.iv, updated_at = excluded.updated_at`,
  )
    .bind(userId, sealed.ciphertext, sealed.iv, next.updatedAt)
    .run();
  return next;
}
