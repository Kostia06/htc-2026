import { db } from "../db";
import type { Env } from "../env";

export async function cached<T>(env: Env, key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  const now = new Date();
  const hit = await db(env).prepare("SELECT value FROM cache WHERE key = ? AND expires_at > ?").bind(key, now.toISOString()).first<{ value: string }>();
  if (hit) return JSON.parse(hit.value) as T;

  const value = await load();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
  await db(env).prepare("INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)").bind(key, JSON.stringify(value), expiresAt).run();
  return value;
}

// compares the leading characters instead of using LIKE, so "_" and "%" in a prefix are not wildcards
export async function invalidate(env: Env, prefix: string) {
  await db(env).prepare("DELETE FROM cache WHERE substr(key, 1, length(?1)) = ?1").bind(prefix).run();
}
