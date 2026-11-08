import { db } from "../db";
import type { Env } from "../env";
import type { FeedCard } from "../feed/types";
import { decryptFor } from "../memory/private/crypto";
import { loadOpen } from "../roadmap/store";
import { clip, DAY_MS, daysUntil } from "./rules";
import type { Candidate } from "./types";

// only the very top of the feed is worth a buzz; the rest waits for the person to scroll
const FEED_TOP = 2;
const DEADLINE_DAYS = 3;
const IDLE_DAYS = 3;
// a report or resume older than this was surely seen in the app already
const READY_WINDOW_MS = 2 * DAY_MS;

const parseCard = (json: string): FeedCard | null => {
  try {
    return JSON.parse(json) as FeedCard;
  } catch {
    return null;
  }
};

export async function feedMatches(env: Env, userId: string): Promise<Candidate[]> {
  const { results } = await db(env).prepare("SELECT card FROM feed_items WHERE user_id = ? AND section = 'all' AND position < ? ORDER BY position")
    .bind(userId, FEED_TOP)
    .all<{ card: string }>();
  return results.flatMap(({ card: json }) => {
    const card = parseCard(json);
    if (!card?.id) return [];
    return [{ kind: "feed_match", key: `feed:${card.id}`, title: clip(`New for you: ${card.title}`, 80), body: clip(card.why || card.org, 120), target: { type: "feed", id: card.id } }];
  });
}

export async function savedDeadlines(env: Env, userId: string, now: Date): Promise<Candidate[]> {
  const { results } = await db(env).prepare("SELECT card FROM feed_actions WHERE user_id = ? AND action = 'save'").bind(userId).all<{ card: string }>();
  return results.flatMap(({ card: json }) => {
    const card = parseCard(json);
    const days = card ? daysUntil(card.when, now, DEADLINE_DAYS) : null;
    if (!card?.id || days === null) return [];
    const soon = days <= 1 ? "tomorrow" : `in ${days} days`;
    return [{ kind: "deadline", key: `deadline:${card.id}`, title: clip(`${card.title} is ${soon}`, 80), body: clip(`You saved this from ${card.org}. Worth a look before it passes.`, 120), target: { type: "feed", id: card.id } }];
  });
}

/** The first open step on the Road, once it has sat untouched for three days; again each further week it sits. */
export async function roadNudge(env: Env, userId: string, now: Date): Promise<Candidate[]> {
  const row = await db(env).prepare("SELECT id, updated_at FROM roadmap_steps WHERE user_id = ? AND status IN ('todo', 'started') ORDER BY position LIMIT 1")
    .bind(userId)
    .first<{ id: string; updated_at: string }>();
  if (!row) return [];
  const idleDays = Math.floor((now.getTime() - Date.parse(row.updated_at)) / DAY_MS);
  if (idleDays < IDLE_DAYS) return [];
  const [step] = await loadOpen(env, userId, 0, 1);
  if (!step || step.id !== row.id) return [];
  const week = Math.floor((idleDays - IDLE_DAYS) / 7);
  return [{ kind: "road_nudge", key: `nudge:${row.id}:${week}`, title: clip(`Next on your Road: ${step.title}`, 80), body: clip(step.estimate ? `About ${step.estimate}. A small step keeps the streak going.` : "A small step keeps the streak going.", 120), target: { type: "step", id: row.id } }];
}

type ReportRow = { id: string; mode: string; company_name: string | null; overall: number | null };

export async function finishedReports(env: Env, userId: string, now: Date): Promise<Candidate[]> {
  const { results } = await db(env).prepare(
    `SELECT s.id, s.mode, c.name AS company_name, s.overall FROM voice_sessions s LEFT JOIN companies c ON c.slug = s.company_slug
     WHERE s.user_id = ? AND s.status = 'finished' AND s.finished_at > ? ORDER BY s.finished_at DESC LIMIT 3`,
  )
    .bind(userId, new Date(now.getTime() - READY_WINDOW_MS).toISOString())
    .all<ReportRow>();
  return results.map((r) => {
    const what = r.mode === "networking" ? "networking practice" : "practice interview";
    const at = r.company_name ? ` for ${r.company_name}` : "";
    const score = r.overall === null ? "" : ` You scored ${r.overall}.`;
    return { kind: "report_ready", key: `report:${r.id}`, title: "Your practice report is ready", body: clip(`Feedback on your ${what}${at}.${score}`, 120), target: { type: "report", id: r.id } };
  });
}

type ResumeRow = { id: string; ciphertext: string; iv: string };

export async function tailoredResumes(env: Env, userId: string, now: Date): Promise<Candidate[]> {
  const { results } = await db(env).prepare("SELECT id, ciphertext, iv FROM user_tailored_resumes WHERE user_id = ? AND created_at > ? ORDER BY created_at DESC LIMIT 3")
    .bind(userId, new Date(now.getTime() - READY_WINDOW_MS).toISOString())
    .all<ResumeRow>();
  return Promise.all(
    results.map(async (row) => {
      const { title, company } = JSON.parse(await decryptFor(env.MEMORY_SECRET, userId, row)) as { title?: string; company?: string };
      const job = [title, company].filter(Boolean).join(" at ");
      return { kind: "resume_ready", key: `resume:${row.id}`, title: "Your tailored resume is ready", body: clip(job ? `Adapted for ${job}. Review the changes.` : "Review the changes before you send it.", 120), target: { type: "resume", id: row.id } } satisfies Candidate;
    }),
  );
}
