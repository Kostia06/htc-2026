import { db } from "../db";
import type { Env } from "../env";
import { sha256 } from "../lib/hash";
import { type Lane, laneOf } from "./lanes";
import { MIN_PEOPLE, type RoadLine } from "./patterns";

const RECENT_REPORTS = 300;
const MAX_QUESTIONS = 12;

type Row = { id: string; role: string; questions_json: string; contributor: string | null };

// a report sent before contributors were recorded stands for one person of its own
const personOf = (row: Row) => row.contributor ?? `report:${row.id}`;

/**
 * Interview questions real people reported for roles on this road, as road lines. Only questions three different
 * people reported are returned, and only the question itself: tips and formats are one person's words.
 */
export async function interviewLines(env: Env, lane: Lane): Promise<RoadLine[]> {
  const { results } = await db(env).prepare(
    "SELECT id, role, questions_json, contributor FROM experiences WHERE is_seeded = 0 ORDER BY created_at DESC LIMIT ?",
  )
    .bind(RECENT_REPORTS)
    .all<Row>();

  const tallies = new Map<string, { text: string; people: Set<string> }>();
  for (const row of results.filter((r) => laneOf(r.role) === lane)) {
    for (const question of JSON.parse(row.questions_json) as string[]) {
      const key = question.trim().toLowerCase();
      const entry = tallies.get(key) ?? { text: question.trim(), people: new Set<string>() };
      entry.people.add(personOf(row));
      tallies.set(key, entry);
    }
  }

  const shown = [...tallies.entries()].filter(([, t]) => t.people.size >= MIN_PEOPLE).sort((a, b) => b[1].people.size - a[1].people.size).slice(0, MAX_QUESTIONS);
  return Promise.all(
    shown.map(async ([key, t]) => ({
      id: `q_${(await sha256(key)).slice(0, 12)}`,
      kind: "interview" as const,
      text: t.text,
      people: t.people.size,
      example: false,
      meToo: false,
    })),
  );
}
