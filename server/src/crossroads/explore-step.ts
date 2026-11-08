import { db } from "../db";
import type { Env } from "../env";
import { insertSteps } from "../roadmap/store";
import type { StepContent } from "../roadmap/types";

// one slot before the first template step: every road gets the step once, at the top, without moving anything else
export const EXPLORE_POSITION = -1;

export function exploreStep(goal: string): StepContent {
  return {
    kind: "explore_memory",
    title: `See what others learned on the road to ${goal}`.slice(0, 80),
    why: "Everyone who reached a job left this road a little clearer. See where your story overlaps theirs.",
    detail: "Open Crossroads: your notes on one side, everyone on your road on the other, and ask about anything that lines up.",
    estimate: "5 min",
    label: "ready_now",
    action: { type: "crossroads" },
  };
}

/** Adds the Crossroads step to this person's road unless it is already there. True when it was just added. */
export async function ensureExploreStep(env: Env, userId: string, goal: string): Promise<boolean> {
  const existing = await db(env).prepare("SELECT 1 AS ok FROM roadmap_steps WHERE user_id = ? AND position = ?").bind(userId, EXPLORE_POSITION).first();
  if (existing) return false;
  // a concurrent request that added it first wins the slot, which is just as good
  return insertSteps(env, userId, EXPLORE_POSITION, [exploreStep(goal)], "template");
}

// opening Crossroads or asking it something is the whole step, so either one finishes it
export async function finishExploreStep(env: Env, userId: string): Promise<void> {
  const now = new Date().toISOString();
  await db(env).prepare(
    "UPDATE roadmap_steps SET status = 'done', completed_at = ?, updated_at = ? WHERE user_id = ? AND position = ? AND status IN ('todo', 'started')",
  )
    .bind(now, now, userId, EXPLORE_POSITION)
    .run();
}
