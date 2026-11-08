import { db } from "../db";
import type { Env } from "../env";
import type { StepKind } from "../roadmap/types";
import { LANE_NAMES, type Lane, roleKey } from "./lanes";
import { MIN_PEOPLE } from "./patterns";

/** A road that ended in a job: step kinds in the order people took them. Real trails are only ever a group of 3+. */
export type Trail = { id: string; role: string; people: number | null; example: boolean; steps: StepKind[]; skills: string[] };
/** "Taken by N people who reached <role>": a step kind most people who got there took. */
export type Badge = { kind: StepKind; people: number; reached: string };

type Row = { id: string; user_id: string | null; role: string; steps_json: string; skills_json: string; is_seeded: number };
type Road = { userId: string; steps: StepKind[]; skills: string[] };

const MAX_TRAIL = 8;
const MAX_TRAILS = 6;

const titleCase = (role: string) => role.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
// "data analyst" and "junior data analyst" are the same road for a badge
const sameRole = (a: string, b: string) => !!a && !!b && (a.includes(b) || b.includes(a));

async function loadRows(env: Env, lane: Lane): Promise<Row[]> {
  const { results } = await db(env).prepare("SELECT id, user_id, role, steps_json, skills_json, is_seeded FROM path_outcomes WHERE lane = ? LIMIT 500")
    .bind(lane)
    .all<Row>();
  return results;
}

const roadOf = (row: Row): Road => ({ userId: row.user_id ?? row.id, steps: JSON.parse(row.steps_json), skills: JSON.parse(row.skills_json) });

// what at least three of these people share, so the trail describes the group and never one person in it
function commonTrail(roads: Road[]): { steps: StepKind[]; skills: string[] } {
  const stepPeople = new Map<StepKind, { people: Set<string>; rank: number[] }>();
  const skillPeople = new Map<string, Set<string>>();
  for (const road of roads) {
    road.steps.forEach((kind, i) => {
      const entry = stepPeople.get(kind) ?? { people: new Set(), rank: [] };
      entry.people.add(road.userId);
      entry.rank.push(i / Math.max(1, road.steps.length - 1));
      stepPeople.set(kind, entry);
    });
    for (const skill of road.skills) skillPeople.set(skill, (skillPeople.get(skill) ?? new Set()).add(road.userId));
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const steps = [...stepPeople.entries()]
    .filter(([, e]) => e.people.size >= MIN_PEOPLE)
    .sort((a, b) => mean(a[1].rank) - mean(b[1].rank) || a[0].localeCompare(b[0]))
    .map(([kind]) => kind)
    .slice(0, MAX_TRAIL);
  const skills = [...skillPeople.entries()].filter(([, p]) => p.size >= MIN_PEOPLE).sort((a, b) => b[1].size - a[1].size).map(([s]) => s).slice(0, 5);
  return { steps, skills };
}

function groupByRole(rows: Row[]) {
  const groups = new Map<string, Road[]>();
  for (const row of rows.filter((r) => !r.is_seeded)) groups.set(row.role, [...(groups.get(row.role) ?? []), roadOf(row)]);
  return groups;
}

const peopleIn = (roads: Road[]) => new Set(roads.map((r) => r.userId)).size;

function badgesFrom(roads: Road[], reached: string): Badge[] {
  const people = new Map<StepKind, Set<string>>();
  for (const road of roads) for (const kind of road.steps) people.set(kind, (people.get(kind) ?? new Set()).add(road.userId));
  return [...people.entries()]
    .filter(([, p]) => p.size >= MIN_PEOPLE)
    .map(([kind, p]) => ({ kind, people: p.size, reached }))
    .sort((a, b) => b.people - a.people || a.kind.localeCompare(b.kind));
}

/** Trails that worked on this road (real groups first, then flagged examples) and the step badges they earn. */
export async function pathsFor(env: Env, lane: Lane, goal: string): Promise<{ trails: Trail[]; badges: Badge[] }> {
  const rows = await loadRows(env, lane);
  const goalKey = roleKey(goal);
  const groups = [...groupByRole(rows).entries()].filter(([, roads]) => peopleIn(roads) >= MIN_PEOPLE);

  const real: Trail[] = groups
    .map(([role, roads]) => ({ id: `trail_${role.replace(/\W+/g, "_")}`, role: titleCase(role), people: peopleIn(roads), example: false, ...commonTrail(roads) }))
    .filter((t) => t.steps.length > 0)
    .sort((a, b) => Number(sameRole(roleKey(b.role), goalKey)) - Number(sameRole(roleKey(a.role), goalKey)) || (b.people ?? 0) - (a.people ?? 0));
  const examples: Trail[] = rows
    .filter((r) => r.is_seeded)
    .map((r) => ({ id: r.id, role: titleCase(r.role), people: null, example: true, steps: JSON.parse(r.steps_json), skills: JSON.parse(r.skills_json) }))
    .sort((a, b) => Number(sameRole(roleKey(b.role), goalKey)) - Number(sameRole(roleKey(a.role), goalKey)) || a.id.localeCompare(b.id));

  // badges speak for the person's own role when enough people reached it, otherwise for the road as a whole
  const ownRole = groups.filter(([role]) => sameRole(role, goalKey)).flatMap(([, roads]) => roads);
  const badges =
    peopleIn(ownRole) >= MIN_PEOPLE
      ? badgesFrom(ownRole, titleCase(goalKey))
      : badgesFrom(rows.filter((r) => !r.is_seeded).map(roadOf), `a job in ${LANE_NAMES[lane]}`);

  return { trails: [...real, ...examples].slice(0, MAX_TRAILS), badges };
}
