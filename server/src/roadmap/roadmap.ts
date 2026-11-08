import type { AgentDeps } from "../agents/core/types";
import { preferTravelled } from "../crossroads/boost";
import { ensureExploreStep } from "../crossroads/explore-step";
import { laneOf } from "../crossroads/lanes";
import { pathsFor } from "../crossroads/paths";
import { getProfile } from "../memory/profile/store";
import { backgroundOf, goalOf, skillsOf } from "./background";
import { ensureResumeSteps, hasPriorWork } from "./prefill";
import { groupByDay, streakDays } from "./progress";
import { refineTemplates } from "./refine";
import { countSteps, insertSteps, loadCompleted, loadOpen, nextPosition } from "./store";
import { personFor, templateSteps, type Person } from "./templates";
import type { RoadmapPage } from "./types";

export const PAGE_STEPS = 6;
// the first plan is a little longer than a page so the person sees there is more below
export const FIRST_BATCH = 8;
// a generous ceiling so a runaway client can't make the path grow forever
export const MAX_STEPS = 40;

export type RoadmapOptions = {
  timeZone: string;
  // how long the background refinement may wait for the model
  refineDeadlineMs: number;
  waitUntil(work: Promise<unknown>): void;
};

// instant: every response is built from stored or template steps; the agent only ever improves them after the response.
// null when the cursor points past the open steps
export async function roadmapPage(deps: AgentDeps, userId: string, cursor: number, options: RoadmapOptions): Promise<RoadmapPage | null> {
  const profile = await getProfile(deps.env, userId);
  const person = personFor(goalOf(profile), skillsOf(profile), hasPriorWork(profile));
  const { env } = deps;

  // what the resume already shows is done before the plan starts, so a strong resume never starts at zero
  if (cursor === 0) await ensureResumeSteps(env, userId, profile);
  let counts = await countSteps(env, userId);
  if (cursor > counts.open) return null;

  // it sits before the first step, so only the first page can show it appearing; added before any refinement starts
  const added = cursor === 0 && (await ensureExploreStep(env, userId, person.goal));
  let next = await loadOpen(env, userId, cursor, PAGE_STEPS);
  if (next.length < PAGE_STEPS && counts.total < MAX_STEPS) {
    const wanted = counts.open === 0 ? FIRST_BATCH : PAGE_STEPS - next.length;
    await extend(deps, userId, person, wanted);
    options.waitUntil(refineTemplates(deps, { userId, person, background: backgroundOf(profile) }, options.refineDeadlineMs));
    counts = await countSteps(env, userId);
    next = await loadOpen(env, userId, cursor, PAGE_STEPS);
  } else if (added) {
    counts = await countSteps(env, userId);
  }
  // reordered within the page only, so cursors keep pointing where they did
  const { badges } = await pathsFor(env, laneOf(person.goal), person.goal);
  next = preferTravelled(next, badges);

  const completed = await loadCompleted(env, userId);
  const end = cursor + next.length;
  const hasMore = counts.open > end || counts.total < MAX_STEPS;
  return {
    goal: person.goal,
    progress: {
      done: counts.done,
      total: counts.total,
      streakDays: streakDays(completed.filter((s) => s.completedVia !== "resume").map((s) => s.completedAt ?? ""), options.timeZone),
    },
    next,
    nextCursor: hasMore && next.length > 0 ? String(end) : null,
    completed: groupByDay(completed, options.timeZone),
  };
}

// appends the next template steps; a concurrent request that got there first simply wins
async function extend(deps: AgentDeps, userId: string, person: Person, count: number) {
  const from = await nextPosition(deps.env, userId);
  const capped = Math.min(count, MAX_STEPS - from);
  if (capped <= 0) return;
  await insertSteps(deps.env, userId, from, templateSteps(person, from, capped), "template");
}
