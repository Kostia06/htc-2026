import { db } from "../db";
import type { Env } from "../env";

export async function cached<T>(env: Env, key: string, ttlSeconds: number, load: () => Promise<T>, now = new Date()): Promise<T> {
  const hit = await db(env).prepare("SELECT value FROM cache WHERE key = ? AND expires_at > ?").bind(key, now.toISOString()).first<{ value: string }>();
  if (hit) return JSON.parse(hit.value) as T;

  const value = await load();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
  await db(env).prepare("INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)").bind(key, JSON.stringify(value), expiresAt).run();
  return value;
}

// every live entry under a prefix, keyed by the rest of the key; for small public namespaces that are read whole
export async function cachedUnderPrefix<T>(env: Env, prefix: string, now = new Date()): Promise<Map<string, T>> {
  const { results } = await db(env)
    .prepare("SELECT key, value FROM cache WHERE substr(key, 1, length(?1)) = ?1 AND expires_at > ?2")
    .bind(prefix, now.toISOString())
    .all<{ key: string; value: string }>();
  return new Map(results.map((r) => [r.key.slice(prefix.length), JSON.parse(r.value) as T]));
}

// compares the leading characters instead of using LIKE, so "_" and "%" in a prefix are not wildcards
export async function invalidate(env: Env, prefix: string) {
  await db(env).prepare("DELETE FROM cache WHERE substr(key, 1, length(?1)) = ?1").bind(prefix).run();
}
