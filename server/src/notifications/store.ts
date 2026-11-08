import { db } from "../db";
import type { Env } from "../env";
import { decryptFor, encryptFor } from "../memory/private/crypto";
import type { Candidate, Notification, NotificationKind } from "./types";

type Row = { id: string; kind: NotificationKind; ciphertext: string; iv: string; created_at: string; read_at: string | null; pushed_at: string | null };
type Sealed = Pick<Candidate, "title" | "body" | "target">;

const COLUMNS = "id, kind, ciphertext, iv, created_at, read_at, pushed_at";
// D1 allows 100 bound values per statement
const MAX_IDS = 90;

export const newNotificationId = () => `nt_${crypto.randomUUID()}`;

async function decode(env: Env, userId: string, row: Row): Promise<Notification> {
  const sealed = JSON.parse(await decryptFor(env.MEMORY_SECRET, userId, row)) as Sealed;
  return { id: row.id, kind: row.kind, ...sealed, createdAt: row.created_at, readAt: row.read_at, pushed: row.pushed_at !== null };
}

const decodeAll = (env: Env, userId: string, rows: Row[]) => Promise.all(rows.map((row) => decode(env, userId, row)));

/** Every dedupe key ever used for this person; the generator never says the same fact twice. */
export async function saidKeys(env: Env, userId: string): Promise<Set<string>> {
  const { results } = await db(env).prepare("SELECT dedupe_key FROM user_notifications WHERE user_id = ?").bind(userId).all<{ dedupe_key: string }>();
  return new Set(results.map((r) => r.dedupe_key));
}

export async function countSince(env: Env, userId: string, since: Date): Promise<number> {
  const row = await db(env).prepare("SELECT count(*) AS n FROM user_notifications WHERE user_id = ? AND created_at > ?").bind(userId, since.toISOString()).first<{ n: number }>();
  return row?.n ?? 0;
}

// a key that raced in from a concurrent run is silently skipped by the unique index rather than said twice
export async function insertNotifications(env: Env, userId: string, candidates: Candidate[], now: Date): Promise<number> {
  if (candidates.length === 0) return 0;
  const at = now.toISOString();
  const statements = await Promise.all(
    candidates.map(async ({ kind, key, title, body, target }) => {
      const sealed = await encryptFor(env.MEMORY_SECRET, userId, JSON.stringify({ title, body, target } satisfies Sealed));
      return db(env).prepare(
        `INSERT INTO user_notifications (id, user_id, kind, dedupe_key, ciphertext, iv, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id, dedupe_key) DO NOTHING`,
      ).bind(newNotificationId(), userId, kind, key, sealed.ciphertext, sealed.iv, at);
    }),
  );
  const results = await db(env).batch(statements);
  return results.reduce((sum, r) => sum + (r.meta.changes ?? 0), 0);
}

export type Cursor = { createdAt: string; id: string };

export const encodeCursor = (n: Pick<Notification, "createdAt" | "id">) => `${n.createdAt}|${n.id}`;

export function decodeCursor(value: string | undefined): Cursor | null {
  if (!value) return null;
  const [createdAt, id] = value.split("|");
  return createdAt && id && !Number.isNaN(Date.parse(createdAt)) ? { createdAt, id } : null;
}

/** Newest first; the cursor is the last row of the previous page. */
export async function listNotifications(env: Env, userId: string, cursor: Cursor | null, limit: number) {
  const page = cursor
    ? db(env).prepare(
        `SELECT ${COLUMNS} FROM user_notifications WHERE user_id = ? AND (created_at < ? OR (created_at = ? AND id < ?))
         ORDER BY created_at DESC, id DESC LIMIT ?`,
      ).bind(userId, cursor.createdAt, cursor.createdAt, cursor.id, limit + 1)
    : db(env).prepare(`SELECT ${COLUMNS} FROM user_notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?`).bind(userId, limit + 1);
  const [rows, unread] = await db(env).batch([page, db(env).prepare("SELECT count(*) AS n FROM user_notifications WHERE user_id = ? AND read_at IS NULL").bind(userId)]);
  const items = await decodeAll(env, userId, (rows.results as Row[]).slice(0, limit));
  const last = items.at(-1);
  return {
    items,
    nextCursor: rows.results.length > limit && last ? encodeCursor(last) : null,
    unread: (unread.results[0] as { n: number } | undefined)?.n ?? 0,
  };
}

export async function unreadCount(env: Env, userId: string): Promise<number> {
  const row = await db(env).prepare("SELECT count(*) AS n FROM user_notifications WHERE user_id = ? AND read_at IS NULL").bind(userId).first<{ n: number }>();
  return row?.n ?? 0;
}

export async function markRead(env: Env, userId: string, ids: string[] | "all", now: Date): Promise<number> {
  const at = now.toISOString();
  if (ids === "all") {
    const result = await db(env).prepare("UPDATE user_notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL").bind(at, userId).run();
    return result.meta.changes ?? 0;
  }
  const chosen = ids.slice(0, MAX_IDS);
  if (chosen.length === 0) return 0;
  const result = await db(env).prepare(
    `UPDATE user_notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL AND id IN (${chosen.map(() => "?").join(", ")})`,
  )
    .bind(at, userId, ...chosen)
    .run();
  return result.meta.changes ?? 0;
}

/** Unread and not pushed yet, from the last day only: an old notification is news to nobody's lock screen. */
export async function awaitingPush(env: Env, userId: string, since: Date): Promise<Notification[]> {
  const { results } = await db(env).prepare(
    `SELECT ${COLUMNS} FROM user_notifications WHERE user_id = ? AND pushed_at IS NULL AND read_at IS NULL AND created_at > ? ORDER BY created_at`,
  )
    .bind(userId, since.toISOString())
    .all<Row>();
  return decodeAll(env, userId, results);
}

export async function markPushed(env: Env, userId: string, ids: string[], now: Date) {
  const chosen = ids.slice(0, MAX_IDS);
  if (chosen.length === 0) return;
  await db(env).prepare(`UPDATE user_notifications SET pushed_at = ? WHERE user_id = ? AND id IN (${chosen.map(() => "?").join(", ")})`)
    .bind(now.toISOString(), userId, ...chosen)
    .run();
}
