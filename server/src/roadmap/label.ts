import { containsQuote } from "../recommend/verify";
import type { StepLabel } from "./types";

// what a step asks of the person; evidence is the model's quote from their profile, checked here
export type StepNeed = { need: string; evidence?: string };

const MAX_STRETCH_MISSING = 1;

// the model never picks the label, like the recommend-* skills: it lists needs, and this decides
export function labelStep(needs: StepNeed[], profileText: string): StepLabel {
  const missing = needs.filter((n) => n.evidence === undefined || !containsQuote(profileText, n.evidence)).length;
  if (missing === 0) return "ready_now";
  return missing <= MAX_STRETCH_MISSING ? "stretch" : "long_term";
}
