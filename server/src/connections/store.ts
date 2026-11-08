import { db } from "../db";
import type { Env } from "../env";
import { decryptFor, encryptFor } from "../memory/private/crypto";

export type Provider = "github";
export type ConnectionStatus = "pending" | "active" | "revoking";

// one imported repo as Skillit keeps it: allowlisted facts and a summary grounded in the repo's own text
export type RepoSummary = { name: string; summary?: string; language?: string; topics: string[]; stars: number; updatedAt?: string };

// what the import added to the person's private data, so disconnecting can take exactly that back out
export type GithubDerived = { repos: RepoSummary[]; addedProjects: string[]; noteIds: string[]; suggestions: string[] };

export type Connection = { accountId: string; status: ConnectionStatus; importedAt?: string; derived?: GithubDerived };

type Row = { account_id: string; status: ConnectionStatus; ciphertext: string | null; iv: string | null; imported_at: string | null };

export async function getConnection(env: Env, userId: string, provider: Provider): Promise<Connection | null> {
  const row = await db(env)
    .prepare("SELECT account_id, status, ciphertext, iv, imported_at FROM user_connections WHERE user_id = ? AND provider = ?")
    .bind(userId, provider)
    .first<Row>();
  if (!row) return null;
  const derived = row.ciphertext && row.iv ? (JSON.parse(await decryptFor(env.MEMORY_SECRET, userId, { ciphertext: row.ciphertext, iv: row.iv })) as GithubDerived) : undefined;
  return { accountId: row.account_id, status: row.status, importedAt: row.imported_at ?? undefined, derived };
}

/** A new sign-in attempt replaces the old one, and with it anything the old one imported. */
export async function startConnection(env: Env, userId: string, provider: Provider, accountId: string) {
  const now = new Date().toISOString();
  await db(env)
    .prepare(
      `INSERT INTO user_connections (user_id, provider, account_id, status, created_at, updated_at) VALUES (?, ?, ?, 'pending', ?, ?)
       ON CONFLICT (user_id, provider) DO UPDATE SET account_id = excluded.account_id, status = 'pending', ciphertext = NULL, iv = NULL,
       imported_at = NULL, updated_at = excluded.updated_at`,
    )
    .bind(userId, provider, accountId, now, now)
    .run();
}

export async function setStatus(env: Env, userId: string, provider: Provider, status: ConnectionStatus) {
  await db(env)
    .prepare("UPDATE user_connections SET status = ?, updated_at = ? WHERE user_id = ? AND provider = ?")
    .bind(status, new Date().toISOString(), userId, provider)
    .run();
}

export async function saveDerived(env: Env, userId: string, derived: GithubDerived | null) {
  const now = new Date().toISOString();
  const sealed = derived ? await encryptFor(env.MEMORY_SECRET, userId, JSON.stringify(derived)) : null;
  await db(env)
    .prepare("UPDATE user_connections SET ciphertext = ?, iv = ?, imported_at = ?, updated_at = ? WHERE user_id = ? AND provider = 'github'")
    .bind(sealed?.ciphertext ?? null, sealed?.iv ?? null, derived ? now : null, now, userId)
    .run();
}

export async function deleteConnectionRow(env: Env, userId: string, provider: Provider) {
  await db(env).prepare("DELETE FROM user_connections WHERE user_id = ? AND provider = ?").bind(userId, provider).run();
}
