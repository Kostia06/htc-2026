import { db } from "../db";
import { Hono } from "hono";
import type { AppContext, Env } from "../env";

const PAGE_SIZE = 20;

type SessionRow = {
  id: string;
  mode: string;
  company_slug: string | null;
  company_name: string | null;
  status: string;
  created_at: string;
  finished_at: string | null;
};
type ScoreRow = { session_id: string; scores_json: string };

// Reads only the unencrypted columns: the plan and the answers stay sealed, this is the list, not the replay.
async function loadPage(env: Env, userId: string, cursor: string | null) {
  const before = cursor ? " AND s.created_at < ?" : "";
  const stmt = db(env).prepare(
    `SELECT s.id, s.mode, s.company_slug, c.name AS company_name, s.status, s.created_at, s.finished_at
     FROM voice_sessions s LEFT JOIN companies c ON c.slug = s.company_slug
     WHERE s.user_id = ?${before}
     ORDER BY s.created_at DESC LIMIT ?`,
  );
  const bound = cursor ? stmt.bind(userId, cursor, PAGE_SIZE + 1) : stmt.bind(userId, PAGE_SIZE + 1);
  const { results } = await bound.all<SessionRow>();
  const page = results.slice(0, PAGE_SIZE);
  return { page, nextCursor: results.length > PAGE_SIZE ? page[page.length - 1].created_at : null };
}

// one average per session over every scored dimension of every turn, on the 1–5 scale people see live
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
    for (const value of Object.values(scores)) {
      entry.sum += value;
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
      score: total && total.n > 0 ? Math.round((total.sum / total.n) * 10) / 10 : null,
      turnCount: total?.turns ?? 0,
    };
  });
  return c.json({ sessions, nextCursor });
});
