import type { Env } from "../env";
import { decryptFor, encryptFor } from "../memory/private/crypto";
import type { RoadmapPage, StepStatus, Unit, UnitContent } from "./types";

const DAY_MS = 86_400_000;
const ALL_UNITS = 10_000;

type UnitRow = { idx: number; ciphertext: string; iv: string };
type StatusRow = { id: string; status: StepStatus };

export async function countUnits(env: Env, userId: string): Promise<number> {
  const row = await env.DB.prepare("SELECT count(*) AS n FROM roadmap_units WHERE user_id = ?").bind(userId).first<{ n: number }>();
  return row?.n ?? 0;
}

export async function loadUnits(env: Env, userId: string, from: number, count: number): Promise<Unit[]> {
  const { results: rows } = await env.DB.prepare("SELECT idx, ciphertext, iv FROM roadmap_units WHERE user_id = ? AND idx >= ? AND idx < ? ORDER BY idx")
    .bind(userId, from, from + count)
    .all<UnitRow>();
  if (rows.length === 0) return [];
  const { results: statuses } = await env.DB.prepare("SELECT id, status FROM roadmap_steps WHERE user_id = ? AND unit_idx >= ? AND unit_idx < ?")
    .bind(userId, from, from + count)
    .all<StatusRow>();
  const statusOf = new Map(statuses.map((s) => [s.id, s.status]));

  return Promise.all(
    rows.map(async (row) => {
      const content: UnitContent = JSON.parse(await decryptFor(env.MEMORY_SECRET, userId, row));
      const steps = content.steps.map((step) => ({ ...step, status: statusOf.get(step.id) ?? "todo" }));
      return { ...content, index: row.idx, steps };
    }),
  );
}

// false when a unit at that index already exists, e.g. a background pre-generation got there first
export async function saveUnit(env: Env, userId: string, index: number, content: UnitContent): Promise<boolean> {
  const now = new Date().toISOString();
  const sealed = await encryptFor(env.MEMORY_SECRET, userId, JSON.stringify(content));
  const insertUnit = env.DB.prepare("INSERT INTO roadmap_units (user_id, idx, ciphertext, iv, created_at) VALUES (?, ?, ?, ?, ?)").bind(
    userId,
    index,
    sealed.ciphertext,
    sealed.iv,
    now,
  );
  const insertSteps = content.steps.map((step) =>
    env.DB.prepare("INSERT INTO roadmap_steps (id, user_id, unit_idx, status, updated_at) VALUES (?, ?, ?, 'todo', ?)").bind(step.id, userId, index, now),
  );
  try {
    await env.DB.batch([insertUnit, ...insertSteps]);
    return true;
  } catch (e) {
    if (/UNIQUE|PRIMARY KEY/i.test((e as Error).message)) return false;
    throw e;
  }
}

export async function stepTitles(env: Env, userId: string): Promise<string[]> {
  const units = await loadUnits(env, userId, 0, ALL_UNITS);
  return units.flatMap((u) => u.steps.map((s) => s.title));
}

export async function progress(env: Env, userId: string, now = new Date()): Promise<RoadmapPage["summary"]> {
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS).toISOString();
  const row = await env.DB.prepare(
    `SELECT count(*) AS total,
            coalesce(sum(status = 'done'), 0) AS done,
            coalesce(sum(status = 'done' AND updated_at >= ?), 0) AS thisWeek
     FROM roadmap_steps WHERE user_id = ?`,
  )
    .bind(weekAgo, userId)
    .first<{ total: number; done: number; thisWeek: number }>();
  return { done: row?.done ?? 0, total: row?.total ?? 0, thisWeek: row?.thisWeek ?? 0 };
}

// scoped by user, so one person can never change another's step
export async function setStepStatus(env: Env, userId: string, stepId: string, status: StepStatus): Promise<boolean> {
  const result = await env.DB.prepare("UPDATE roadmap_steps SET status = ?, updated_at = ? WHERE id = ? AND user_id = ?")
    .bind(status, new Date().toISOString(), stepId, userId)
    .run();
  return result.meta.changes > 0;
}
