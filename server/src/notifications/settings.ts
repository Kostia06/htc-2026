import { db } from "../db";
import type { Env } from "../env";
import { isNotificationKind, type NotificationKind, type NotificationSettings } from "./types";

type SettingsRow = { timezone: string | null; disabled_kinds: string; checked_at: string | null };

const parseKinds = (json: string): NotificationKind[] => {
  try {
    const value = JSON.parse(json) as unknown;
    return Array.isArray(value) ? value.filter(isNotificationKind) : [];
  } catch {
    return [];
  }
};

export async function loadSettings(env: Env, userId: string): Promise<NotificationSettings> {
  const row = await db(env).prepare("SELECT timezone, disabled_kinds, checked_at FROM notification_settings WHERE user_id = ?").bind(userId).first<SettingsRow>();
  return { timezone: row?.timezone ?? null, disabled: row ? parseKinds(row.disabled_kinds) : [], checkedAt: row?.checked_at ?? null };
}

/** Only the fields given change; a missing timezone keeps the one already stored. */
export async function saveSettings(env: Env, userId: string, change: { timezone?: string; disabled?: NotificationKind[] }, now: Date) {
  const current = await loadSettings(env, userId);
  const timezone = change.timezone ?? current.timezone;
  const disabled = change.disabled ?? current.disabled;
  await db(env).prepare(
    `INSERT INTO notification_settings (user_id, timezone, disabled_kinds, updated_at) VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT (user_id) DO UPDATE SET timezone = ?2, disabled_kinds = ?3, updated_at = ?4`,
  )
    .bind(userId, timezone, JSON.stringify(disabled), now.toISOString())
    .run();
  return { ...current, timezone, disabled };
}

/** True for the one caller that should run the generator now; the rest skip until `minGapMs` has passed. */
export async function claimCheck(env: Env, userId: string, now: Date, minGapMs: number) {
  const result = await db(env).prepare(
    `INSERT INTO notification_settings (user_id, checked_at, updated_at) VALUES (?1, ?2, ?2)
     ON CONFLICT (user_id) DO UPDATE SET checked_at = ?2
     WHERE notification_settings.checked_at IS NULL OR notification_settings.checked_at < ?3`,
  )
    .bind(userId, now.toISOString(), new Date(now.getTime() - minGapMs).toISOString())
    .run();
  return (result.meta.changes ?? 0) > 0;
}

// the cron's pick: people with a profile, the ones checked longest ago (or never) first
export async function dueForCheck(env: Env, now: Date, minGapMs: number, limit: number) {
  const { results } = await db(env).prepare(
    `SELECT p.user_id FROM user_profiles p LEFT JOIN notification_settings s ON s.user_id = p.user_id
     WHERE s.checked_at IS NULL OR s.checked_at < ? ORDER BY s.checked_at IS NOT NULL, s.checked_at LIMIT ?`,
  )
    .bind(new Date(now.getTime() - minGapMs).toISOString(), limit)
    .all<{ user_id: string }>();
  return results.map((r) => r.user_id);
}

export async function saveDevice(env: Env, userId: string, token: string, now: Date) {
  await db(env).prepare(
    `INSERT INTO notification_devices (token, user_id, platform, created_at, updated_at) VALUES (?1, ?2, 'ios', ?3, ?3)
     ON CONFLICT (token) DO UPDATE SET user_id = ?2, updated_at = ?3`,
  )
    .bind(token, userId, now.toISOString())
    .run();
}

export async function removeDevice(env: Env, userId: string, token: string) {
  const result = await db(env).prepare("DELETE FROM notification_devices WHERE token = ? AND user_id = ?").bind(token, userId).run();
  return (result.meta.changes ?? 0) > 0;
}

export async function devicesFor(env: Env, userId: string): Promise<string[]> {
  const { results } = await db(env).prepare("SELECT token FROM notification_devices WHERE user_id = ?").bind(userId).all<{ token: string }>();
  return results.map((r) => r.token);
}

// APNs said these tokens are dead (app deleted, token rotated); keeping them would only fail again
export async function forgetTokens(env: Env, tokens: string[]) {
  if (tokens.length === 0) return;
  await db(env).batch(tokens.map((token) => db(env).prepare("DELETE FROM notification_devices WHERE token = ?").bind(token)));
}
