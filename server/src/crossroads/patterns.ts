import { db } from "../db";
import type { Env } from "../env";
import { MIN_REPORTS } from "../memory/insights";
import type { Lane } from "./lanes";

// the same rule as interview reports: fewer than three people could point back at one of them
export const MIN_PEOPLE = MIN_REPORTS;
const MAX_PATTERNS = 60;

export const PATTERN_KINDS = ["struggle", "tip", "interview", "win"] as const;
export type PatternKind = (typeof PATTERN_KINDS)[number];

/**
 * One line from the road. `people` is how many distinct real people stand behind it, and is null below three.
 * `example` marks a seeded line nobody reported: it is shown so the road isn't empty, and never counted as a person.
 */
export type RoadLine = { id: string; kind: PatternKind; text: string; people: number | null; example: boolean; meToo: boolean };

type Row = { id: string; kind: PatternKind; text: string; is_seeded: number; votes: number; mine: number };

export function visibleLine(row: Row): RoadLine | null {
  const people = row.votes >= MIN_PEOPLE ? row.votes : null;
  const example = row.is_seeded === 1;
  // a real line under three people stays hidden, even from the people who back it
  if (!example && people === null) return null;
  return { id: row.id, kind: row.kind, text: row.text, people, example, meToo: row.mine > 0 };
}

// real lines with the most people first, then examples; ties keep a stable order so the screen doesn't shuffle
const byWeight = (a: RoadLine, b: RoadLine) => Number(a.example) - Number(b.example) || (b.people ?? 0) - (a.people ?? 0) || a.id.localeCompare(b.id);

export async function linesFor(env: Env, userId: string, lane: Lane): Promise<RoadLine[]> {
  const { results } = await db(env).prepare(
    `SELECT p.id, p.kind, p.text, p.is_seeded,
       (SELECT count(*) FROM road_pattern_votes v WHERE v.pattern_id = p.id) AS votes,
       (SELECT count(*) FROM road_pattern_votes v WHERE v.pattern_id = p.id AND v.user_id = ?) AS mine
     FROM road_patterns p WHERE p.lane IN (?, 'any') ORDER BY p.is_seeded, p.created_at DESC LIMIT ?`,
  )
    .bind(userId, lane, MAX_PATTERNS)
    .all<Row>();
  return results.map(visibleLine).filter((line): line is RoadLine => line !== null).sort(byWeight);
}

async function lineFor(env: Env, userId: string, id: string): Promise<RoadLine | null> {
  const row = await db(env).prepare(
    `SELECT p.id, p.kind, p.text, p.is_seeded,
       (SELECT count(*) FROM road_pattern_votes v WHERE v.pattern_id = p.id) AS votes,
       (SELECT count(*) FROM road_pattern_votes v WHERE v.pattern_id = p.id AND v.user_id = ?) AS mine
     FROM road_patterns p WHERE p.id = ?`,
  )
    .bind(userId, id)
    .first<Row>();
  return row ? visibleLine(row) : null;
}

/** "That's me too": the person adds themselves behind a line, or steps back. null when there is no such line. */
export async function standBehind(env: Env, userId: string, id: string, behind: boolean): Promise<{ line: RoadLine | null } | null> {
  const exists = await db(env).prepare("SELECT 1 AS ok FROM road_patterns WHERE id = ?").bind(id).first();
  if (!exists) return null;
  const statement = behind
    ? db(env).prepare("INSERT OR IGNORE INTO road_pattern_votes (pattern_id, user_id, created_at) VALUES (?, ?, ?)").bind(id, userId, new Date().toISOString())
    : db(env).prepare("DELETE FROM road_pattern_votes WHERE pattern_id = ? AND user_id = ?").bind(id, userId);
  await statement.run();
  // the line itself may still be hidden: a real one stays out of sight until three people stand behind it
  return { line: await lineFor(env, userId, id) };
}
