import { db } from "../db";
import { issueExpiringSessionFor } from "../auth/session";
import type { Env } from "../env";
import { sha256 } from "../lib/hash";

// short, because the refresh credential below is what keeps a headset signed in
export const ACCESS_TOKEN_MS = 60 * 60 * 1000;
// sliding: every refresh starts the 60 days again, so a headset used weekly never asks for the code twice
export const REFRESH_LIFETIME_MS = 60 * 86_400_000;
// a headset polls for launches every couple of seconds; one that hasn't in this long has the page closed
export const CONNECTED_WINDOW_MS = 30_000;

export type HeadsetCredentials = {
  token: string;
  expiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
  deviceId: string;
  deviceName: string;
};

export type HeadsetDevice = { id: string; name: string; createdAt: string; lastSeenAt: string; connected: boolean };

type DeviceRow = { id: string; user_id: string; name: string; refresh_hash: string; refresh_expires_at: string; created_at: string; last_seen_at: string; revoked_at: string | null };

/** "Quest 3", "Quest Pro", "Pico 4"… from the browser's user agent; "Headset" when it doesn't say. */
export function headsetNameFrom(userAgent: string | undefined): string {
  const match = userAgent?.match(/\b((?:Quest|Pico)(?: \d+| Pro)?)\b/);
  return match?.[1] ?? "Headset";
}

function b64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const randomSecret = () => b64url(crypto.getRandomValues(new Uint8Array(32)));

// the stored hash is peppered with the server secret, so a copy of the table alone can't be replayed
const hashRefresh = (secret: string, refreshToken: string) => sha256(`${secret}:headset-refresh:${refreshToken}`);

function isSameHash(expected: string, actual: string) {
  if (expected.length !== actual.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  return diff === 0;
}

async function credentialsFor(secret: string, userId: string, deviceId: string, deviceName: string, refreshToken: string, now: Date) {
  const expiresAt = new Date(now.getTime() + ACCESS_TOKEN_MS);
  return {
    token: await issueExpiringSessionFor(secret, userId, expiresAt),
    expiresAt: expiresAt.toISOString(),
    refreshToken,
    refreshExpiresAt: new Date(now.getTime() + REFRESH_LIFETIME_MS).toISOString(),
    deviceId,
    deviceName,
  } satisfies HeadsetCredentials;
}

export async function registerHeadset(env: Env, userId: string, name: string, secret: string, now = new Date()): Promise<HeadsetCredentials> {
  const deviceId = crypto.randomUUID();
  const refreshToken = `${deviceId}.${randomSecret()}`;
  const creds = await credentialsFor(secret, userId, deviceId, name, refreshToken, now);
  await db(env).prepare(
    "INSERT INTO headset_devices (id, user_id, name, refresh_hash, refresh_expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(deviceId, userId, name, await hashRefresh(secret, refreshToken), creds.refreshExpiresAt, now.toISOString(), now.toISOString())
    .run();
  return creds;
}

/** Trades a refresh credential for a new access token, rotating the credential. Null means: back to the keypad. */
export async function refreshHeadset(env: Env, refreshToken: string, secret: string, now = new Date()): Promise<HeadsetCredentials | null> {
  const [deviceId, part] = refreshToken.split(".");
  if (!deviceId || !part) return null;
  const row = await db(env).prepare("SELECT * FROM headset_devices WHERE id = ?").bind(deviceId).first<DeviceRow>();
  if (!row || row.revoked_at || row.refresh_expires_at <= now.toISOString()) return null;
  if (!isSameHash(row.refresh_hash, await hashRefresh(secret, refreshToken))) return null;

  const nextToken = `${deviceId}.${randomSecret()}`;
  const creds = await credentialsFor(secret, row.user_id, deviceId, row.name, nextToken, now);
  // conditional on the old hash: two refreshes racing with the same credential can't both rotate it
  const result = await db(env).prepare("UPDATE headset_devices SET refresh_hash = ?, refresh_expires_at = ?, last_seen_at = ? WHERE id = ? AND refresh_hash = ?")
    .bind(await hashRefresh(secret, nextToken), creds.refreshExpiresAt, now.toISOString(), deviceId, row.refresh_hash)
    .run();
  return result.meta.changes === 1 ? creds : null;
}

const toDevice = (row: DeviceRow, now: Date): HeadsetDevice => ({
  id: row.id,
  name: row.name,
  createdAt: row.created_at,
  lastSeenAt: row.last_seen_at,
  connected: new Date(row.last_seen_at).getTime() > now.getTime() - CONNECTED_WINDOW_MS,
});

export async function listHeadsets(env: Env, userId: string, now = new Date()): Promise<HeadsetDevice[]> {
  const { results } = await db(env).prepare("SELECT * FROM headset_devices WHERE user_id = ? AND revoked_at IS NULL AND refresh_expires_at > ? ORDER BY last_seen_at DESC")
    .bind(userId, now.toISOString())
    .all<DeviceRow>();
  return results.map((row) => toDevice(row, now));
}

export async function revokeHeadset(env: Env, userId: string, deviceId: string, now = new Date()) {
  const result = await db(env).prepare("UPDATE headset_devices SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL")
    .bind(now.toISOString(), deviceId, userId)
    .run();
  return result.meta.changes === 1;
}

/** Marks the headset seen now. "unknown" when it isn't this person's live headset: its access token may still verify, but it should sign in again. */
export async function touchHeadset(env: Env, userId: string, deviceId: string, now = new Date()): Promise<"ok" | "unknown"> {
  const result = await db(env).prepare("UPDATE headset_devices SET last_seen_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL")
    .bind(now.toISOString(), deviceId, userId)
    .run();
  return result.meta.changes === 1 ? "ok" : "unknown";
}

export async function isHeadsetConnected(env: Env, userId: string, now = new Date()) {
  const since = new Date(now.getTime() - CONNECTED_WINDOW_MS).toISOString();
  const row = await db(env).prepare("SELECT 1 AS present FROM headset_devices WHERE user_id = ? AND revoked_at IS NULL AND last_seen_at > ? LIMIT 1")
    .bind(userId, since)
    .first();
  return row !== null;
}

export async function deleteStaleHeadsets(env: Env, now = new Date()) {
  const result = await db(env).prepare("DELETE FROM headset_devices WHERE revoked_at IS NOT NULL OR refresh_expires_at <= ?").bind(now.toISOString()).run();
  return result.meta.changes;
}
