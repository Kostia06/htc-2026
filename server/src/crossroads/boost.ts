import type { Step } from "../roadmap/types";
import type { Badge } from "./paths";

// a travelled step may pass one untravelled step, never more: the road still reads in the order it was planned
const BOOST = 1.5;

/** Marks the steps people who got the job also took, and lifts each of them at most one place within the page. */
export function preferTravelled(steps: Step[], badges: Badge[]): Step[] {
  const byKind = new Map(badges.map((b) => [b.kind, b]));
  return steps
    .map((step, i) => {
      const badge = byKind.get(step.kind);
      const marked: Step = badge ? { ...step, travelled: { people: badge.people, reached: badge.reached } } : step;
      return { step: marked, key: i - (badge ? BOOST : 0) };
    })
    .sort((a, b) => a.key - b.key)
    .map(({ step }) => step);
}
