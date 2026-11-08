import type { Env } from "../env";
import { listMemories, type MemoryKind } from "../memory/private/store";
import { getProfile } from "../memory/profile/store";
import { goalOf } from "../roadmap/background";
import { interviewLines } from "./interviews";
import { LANE_NAMES, type Lane, laneOf } from "./lanes";
import { linesFor, MIN_PEOPLE, type RoadLine } from "./patterns";
import { type Badge, pathsFor, type Trail } from "./paths";
import { researchFor, type ResearchFact } from "./research";
import { type Link, linkItems } from "./similarity";

const MAX_YOURS = 24;
const MAX_PROFILE_SKILLS = 6;
const MAX_LINES = 24;

/** One thing the person knows about themselves. Only `memory` items can be deleted; `profile` ones are edited in Profile. */
export type YourItem = { id: string; kind: MemoryKind; text: string; source: "memory" | "profile" };

export type Crossroads = {
  road: { goal: string; lane: Lane; laneName: string };
  you: YourItem[];
  everyone: RoadLine[];
  research: ResearchFact[];
  links: Link[];
  trails: Trail[];
  badges: Badge[];
  minPeople: number;
};

async function yourItems(env: Env, userId: string): Promise<{ goal: string; items: YourItem[] }> {
  const [memories, profile] = await Promise.all([listMemories(env, userId), getProfile(env, userId)]);
  const items: YourItem[] = memories.slice(0, MAX_YOURS).map((m) => ({ id: m.id, kind: m.kind, text: m.text, source: "memory" }));
  const known = new Set(items.map((i) => i.text.toLowerCase()));
  // a brand-new person has no memories yet; their profile skills still give the screen something to connect
  const skills = profile.skills.map((s) => s.name.trim()).filter((name) => name && !known.has(name.toLowerCase())).slice(0, MAX_PROFILE_SKILLS);
  items.push(...skills.map((name, i): YourItem => ({ id: `profile_skill_${i}`, kind: "skill", text: name, source: "profile" })));
  return { goal: goalOf(profile), items };
}

// lines that touch the person's own story come first, strongest link first; the rest keep their weight order
function linkedFirst(lines: RoadLine[], links: Link[]): RoadLine[] {
  const best = new Map<string, number>();
  for (const link of links) best.set(link.everyone, Math.max(best.get(link.everyone) ?? 0, link.score));
  return lines
    .map((line, i) => ({ line, i, score: best.get(line.id) ?? 0 }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map(({ line }) => line)
    .slice(0, MAX_LINES);
}

/** Everything the Crossroads screen shows, in one payload. Never carries another person's id or unscrubbed words. */
export async function crossroadsFor(env: Env, userId: string): Promise<Crossroads> {
  const { goal, items } = await yourItems(env, userId);
  const lane = laneOf(goal);
  const [lines, interviews, research, paths] = await Promise.all([
    linesFor(env, userId, lane),
    interviewLines(env, lane),
    researchFor(env, userId, lane),
    pathsFor(env, lane, goal),
  ]);
  const everyone = [...interviews, ...lines];
  const links = await linkItems(env, items, [...everyone, ...research.map((f) => ({ id: f.id, text: f.text }))]);
  const shown = linkedFirst(everyone, links);
  const visible = new Set([...shown.map((l) => l.id), ...research.map((f) => f.id)]);
  return {
    road: { goal, lane, laneName: LANE_NAMES[lane] },
    you: items,
    everyone: shown,
    research,
    links: links.filter((link) => visible.has(link.everyone)),
    trails: paths.trails,
    badges: paths.badges,
    minPeople: MIN_PEOPLE,
  };
}
