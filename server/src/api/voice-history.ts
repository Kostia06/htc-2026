import { Hono } from "hono";
import { db } from "../db";
import type { AppContext, Env } from "../env";
import { turnScore } from "../voice/debrief";

const PAGE_SIZE = 20;

type SessionRow = {
  id: string;
  mode: string;
  company_slug: string | null;
  company_name: string | null;
  status: string;
  created_at: string;
  finished_at: string | null;
  overall: number | null;
};
type ScoreRow = { session_id: string; scores_json: string };

// Reads only the unencrypted columns: the plan and the answers stay sealed, this is the list, not the replay.
// Sessions from the retired networking mode are left out rather than shown as something they weren't.
async function loadPage(env: Env, userId: string, cursor: string | null) {
  const before = cursor ? " AND s.created_at < ?" : "";
  const stmt = db(env).prepare(
    `SELECT s.id, s.mode, s.company_slug, c.name AS company_name, s.status, s.created_at, s.finished_at, s.overall
     FROM voice_sessions s LEFT JOIN companies c ON c.slug = s.company_slug
     WHERE s.user_id = ? AND s.mode = 'interview'${before}
     ORDER BY s.created_at DESC LIMIT ?`,
  );
  const bound = cursor ? stmt.bind(userId, cursor, PAGE_SIZE + 1) : stmt.bind(userId, PAGE_SIZE + 1);
  const { results } = await bound.all<SessionRow>();
  const page = results.slice(0, PAGE_SIZE);
  return { page, nextCursor: results.length > PAGE_SIZE ? page[page.length - 1].created_at : null };
}

// for sessions without a saved report score: the mean of each turn's 0-100 score, mapped the way the report maps it
async function scoresBySession(env: Env, userId: string, sessionIds: string[]) {
  const totals = new Map<string, { sum: number; n: number; turns: number }>();
  if (sessionIds.length === 0) return totals;
  const marks = sessionIds.map(() => "?").join(", ");
  const { results } = await db(env).prepare(`SELECT session_id, scores_json FROM voice_turns WHERE user_id = ? AND session_id IN (${marks})`)
    .bind(userId, ...sessionIds)
    .all<ScoreRow>();
  for (const row of results) {
    const entry = totals.get(row.session_id) ?? { sum: 0, n: 0, turns: 0 };
    entry.turns++;
    const scores = (JSON.parse(row.scores_json) as { scores?: Record<string, number> }).scores ?? {};
    const score = turnScore({ scores });
    if (score !== null) {
      entry.sum += score;
      entry.n++;
    }
    totals.set(row.session_id, entry);
  }
  return totals;
}

export const voiceHistory = new Hono<AppContext>();

voiceHistory.get("/", async (c) => {
  const userId = c.var.sessionId;
  const { page, nextCursor } = await loadPage(c.env, userId, c.req.query("cursor") ?? null);
  const totals = await scoresBySession(c.env, userId, page.map((s) => s.id));
  const sessions = page.map((row) => {
    const total = totals.get(row.id);
    return {
      id: row.id,
      mode: row.mode,
      companySlug: row.company_slug,
      companyName: row.company_name,
      status: row.status,
      createdAt: row.created_at,
      finishedAt: row.finished_at,
      score: row.overall ?? (total && total.n > 0 ? Math.round(total.sum / total.n) : null),
      turnCount: total?.turns ?? 0,
    };
  });
  return c.json({ sessions, nextCursor });
});
