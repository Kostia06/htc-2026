import { db } from "../../db";
import type { Env } from "../../env";
import type { Platform, SkillOutput } from "./types";

type RunRow = { id: string; skill: string; platform: string; status: string; output: string | null; error: string | null; created_at: string; finished_at: string | null };

export async function recordRunStart(env: Env, run: { userId: string; skill: string; platform: Platform }) {
  const id = crypto.randomUUID();
  await db(env).prepare("INSERT INTO agent_runs (id, user_id, skill, platform, status, created_at) VALUES (?, ?, ?, ?, 'running', ?)")
    .bind(id, run.userId, run.skill, run.platform, new Date().toISOString())
    .run();
  return id;
}

export async function recordRunDone(env: Env, id: string, output: SkillOutput) {
  await db(env).prepare("UPDATE agent_runs SET status = 'done', output = ?, finished_at = ? WHERE id = ?")
    .bind(JSON.stringify(output), new Date().toISOString(), id)
    .run();
}

export async function recordRunFailed(env: Env, id: string, error: string) {
  await db(env).prepare("UPDATE agent_runs SET status = 'failed', error = ?, finished_at = ? WHERE id = ?")
    .bind(error.slice(0, 500), new Date().toISOString(), id)
    .run();
}

// filtered by owner in SQL, so someone else's run looks exactly like a missing one
export async function findRun(env: Env, id: string, userId: string) {
  const row = await db(env).prepare(
    "SELECT id, skill, platform, status, output, error, created_at, finished_at FROM agent_runs WHERE id = ? AND user_id = ?",
  )
    .bind(id, userId)
    .first<RunRow>();
  if (!row) return null;
  return {
    id: row.id,
    skill: row.skill,
    platform: row.platform,
    status: row.status,
    output: row.output ? (JSON.parse(row.output) as SkillOutput) : null,
    error: row.error,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
  };
}
