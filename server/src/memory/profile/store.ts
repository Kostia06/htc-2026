import type { Env } from "../../env";
import { decryptFor, encryptFor } from "../private/crypto";
import { applyPatch, emptyProfile } from "./patch";
import type { Profile, ProfilePatch } from "./types";

type ProfileRow = { ciphertext: string; iv: string };

// one encrypted row per person; like private memories it never enters the shared vector index
export async function getProfile(env: Env, userId: string): Promise<Profile> {
  const row = await env.DB.prepare("SELECT ciphertext, iv FROM user_profiles WHERE user_id = ?").bind(userId).first<ProfileRow>();
  if (!row) return emptyProfile();
  return { ...emptyProfile(), ...JSON.parse(await decryptFor(env.MEMORY_SECRET, userId, row)) };
}

export async function updateProfile(env: Env, userId: string, patch: ProfilePatch): Promise<Profile> {
  const next = applyPatch(await getProfile(env, userId), patch);
  const sealed = await encryptFor(env.MEMORY_SECRET, userId, JSON.stringify(next));
  await env.DB.prepare(
    `INSERT INTO user_profiles (user_id, ciphertext, iv, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET ciphertext = excluded.ciphertext, iv = excluded.iv, updated_at = excluded.updated_at`,
  )
    .bind(userId, sealed.ciphertext, sealed.iv, next.updatedAt)
    .run();
  return next;
}

export async function deleteProfile(env: Env, userId: string): Promise<boolean> {
  const result = await env.DB.prepare("DELETE FROM user_profiles WHERE user_id = ?").bind(userId).run();
  return result.meta.changes > 0;
}
