import type { Assessment, Level } from "./types";
import { bannedPhrasesIn, withoutBannedPhrases } from "./verify";

// a fixed vocabulary per level, so the model never improvises how confident to sound
export const LABELS: Record<Level, string> = {
  ready_now: "You meet what they list as required. Meeting the requirements doesn't guarantee an interview.",
  stretch: "Worth applying. You're missing a few things they ask for.",
  long_term: "A goal to work toward, not one to apply for yet.",
  cant_tell: "I need to know more before I can say.",
};

const FALLBACK_STEP = "Read the full page, then tell me if you want help with an application.";
const FALLBACK_PATH = "Ask me for a step-by-step plan toward this.";

const isOneQuestion = (text: string) => text.trim().endsWith("?") && text.split("?").length === 2 && bannedPhrasesIn(text).length === 0;

function oneQuestion(proposed: string | undefined, assessment: Assessment) {
  if (proposed && isOneQuestion(proposed)) return proposed.trim();
  const gap = assessment.unknown.find((u) => u.kind === "hard") ?? assessment.unknown.find((u) => u.kind !== "preferred");
  if (!gap) return "I couldn't confirm the requirements on this page. Can you paste the posting text?";
  return `I can't judge this yet. Do you meet "${gap.requirement.replace(/\?/g, "")}"?`;
}

export function nextStep(draft: { next_step: string; path: string; question?: string }, assessment: Assessment) {
  switch (assessment.level) {
    case "cant_tell":
      return oneQuestion(draft.question, assessment);
    case "long_term":
      return withoutBannedPhrases(draft.path) || FALLBACK_PATH;
    default:
      return withoutBannedPhrases(draft.next_step) || FALLBACK_STEP;
  }
}
