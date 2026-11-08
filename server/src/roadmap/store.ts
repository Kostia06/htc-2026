import { db } from "../db";
import type { Env } from "../env";
import { decryptFor, encryptFor } from "../memory/private/crypto";
import type { Step, StepContent, StepSource, StepStatus } from "./types";

type Row = { id: string; position: number; source: StepSource; ciphertext: string; iv: string; status: StepStatus; completed_at: string | null };

const COLUMNS = "id, position, source, ciphertext, iv, status, completed_at";

export type Counts = { total: number; done: number; open: number };

export async function countSteps(env: Env, userId: string): Promise<Counts> {
  const row = await db(env).prepare(
    `SELECT count(*) AS total,
            coalesce(sum(CASE WHEN status = 'done' THEN 1 ELSE 0 END), 0) AS done,
            coalesce(sum(CASE WHEN status IN ('todo', 'started') THEN 1 ELSE 0 END), 0) AS open
     FROM roadmap_steps WHERE user_id = ?`,
  )
    .bind(userId)
    .first<Counts>();
  return { total: row?.total ?? 0, done: row?.done ?? 0, open: row?.open ?? 0 };
}

// the person's open steps in path order, skipping the first `from` of them
export async function loadOpen(env: Env, userId: string, from: number, limit: number): Promise<Step[]> {
  const { results } = await db(env).prepare(
    `SELECT ${COLUMNS} FROM roadmap_steps WHERE user_id = ? AND status IN ('todo', 'started') ORDER BY position LIMIT ? OFFSET ?`,
  )
    .bind(userId, limit, from)
    .all<Row>();
  return decodeAll(env, userId, results);
}

export async function loadCompleted(env: Env, userId: string): Promise<Step[]> {
  const { results } = await db(env).prepare(`SELECT ${COLUMNS} FROM roadmap_steps WHERE user_id = ? AND status = 'done' ORDER BY completed_at DESC`)
    .bind(userId)
    .all<Row>();
  return decodeAll(env, userId, results);
}

export async function loadAll(env: Env, userId: string): Promise<Step[]> {
  const { results } = await db(env).prepare(`SELECT ${COLUMNS} FROM roadmap_steps WHERE user_id = ? ORDER BY position`).bind(userId).all<Row>();
  return decodeAll(env, userId, results);
}

export async function nextPosition(env: Env, userId: string): Promise<number> {
  const row = await db(env).prepare("SELECT coalesce(max(position) + 1, 0) AS n FROM roadmap_steps WHERE user_id = ?").bind(userId).first<{ n: number }>();
  return row?.n ?? 0;
}

// false when another request already filled one of these positions; the stored path then wins
export async function insertSteps(env: Env, userId: string, from: number, contents: StepContent[], source: StepSource): Promise<boolean> {
  const now = new Date().toISOString();
  const statements = await Promise.all(
    contents.map(async (content, i) => {
      const sealed = await encryptFor(env.MEMORY_SECRET, userId, JSON.stringify(content));
      return db(env).prepare(
        "INSERT INTO roadmap_steps (id, user_id, position, source, ciphertext, iv, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'todo', ?, ?)",
      ).bind(`st_${crypto.randomUUID()}`, userId, from + i, source, sealed.ciphertext, sealed.iv, now, now);
    }),
  );
  if (statements.length === 0) return true;
  try {
    await db(env).batch(statements);
    return true;
  } catch (e) {
    if (/UNIQUE|PRIMARY KEY/i.test((e as Error).message)) return false;
    throw e;
  }
}

// only while still untouched, so a step the person finished meanwhile keeps the text they finished
export async function rewriteStep(env: Env, userId: string, id: string, content: StepContent): Promise<boolean> {
  const sealed = await encryptFor(env.MEMORY_SECRET, userId, JSON.stringify(content));
  const result = await db(env).prepare(
    "UPDATE roadmap_steps SET ciphertext = ?, iv = ?, source = 'agent', updated_at = ? WHERE id = ? AND user_id = ? AND status = 'todo'",
  )
    .bind(sealed.ciphertext, sealed.iv, new Date().toISOString(), id, userId)
    .run();
  return result.meta.changes > 0;
}

// scoped by user, so one person can never change another's step; null when the step isn't theirs
export async function setStepStatus(env: Env, userId: string, id: string, status: StepStatus, note: string | undefined): Promise<Step | null> {
  const row = await db(env).prepare(`SELECT ${COLUMNS} FROM roadmap_steps WHERE id = ? AND user_id = ?`).bind(id, userId).first<Row>();
  if (!row) return null;
  const content = await decode(env, userId, row);
  if (note !== undefined) content.note = note || undefined;
  const now = new Date().toISOString();
  const completedAt = status === "done" ? (row.completed_at ?? now) : null;
  const sealed = await encryptFor(env.MEMORY_SECRET, userId, JSON.stringify(content));
  await db(env).prepare("UPDATE roadmap_steps SET status = ?, completed_at = ?, ciphertext = ?, iv = ?, updated_at = ? WHERE id = ? AND user_id = ?")
    .bind(status, completedAt, sealed.ciphertext, sealed.iv, now, id, userId)
    .run();
  return toStep({ ...row, status, completed_at: completedAt }, content);
}

async function decode(env: Env, userId: string, row: Row): Promise<StepContent> {
  const content = JSON.parse(await decryptFor(env.MEMORY_SECRET, userId, row)) as StepContent;
  // steps written before the networking voice mode was retired still carry its action; they are plain steps now
  if (content.action && content.action.type !== "interview" && content.action.type !== "crossroads") delete content.action;
  return content;
}

function decodeAll(env: Env, userId: string, rows: Row[]): Promise<Step[]> {
  return Promise.all(rows.map(async (row) => toStep(row, await decode(env, userId, row))));
}

function toStep(row: Row, content: StepContent): Step {
  const { note, ...rest } = content;
  return { ...rest, id: row.id, status: row.status, completedAt: row.completed_at, note: note ?? null, source: row.source };
}
