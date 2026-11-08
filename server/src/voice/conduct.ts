import type { Debrief } from "./debrief";
import { CONDUCT_CLOSE } from "./instructions";
import type { StoredTurn } from "./store";

// Curly apostrophes and case vary between transcripts; the words do not.
const normalize = (text: string) => text.toLowerCase().replace(/[‘’]/g, "'");
const MARKER = normalize(CONDUCT_CLOSE).replace(/\.$/, "");

/**
 * Whether the interviewer closed the call with the fixed conduct sentence from liveInstructions.
 * `closingLine` is the agent's last line, which the client sends because no answer followed it;
 * the last turn's question covers a candidate who still spoke after it.
 */
export function endedForConduct(turns: Pick<StoredTurn, "question">[], closingLine?: string): boolean {
  const lines = [closingLine, turns.at(-1)?.question];
  return lines.some((line) => typeof line === "string" && normalize(line).includes(MARKER));
}

/** The report says so up front, on every platform, rather than scoring it like a normal finish. */
export function noteConductEnding(debrief: Debrief): Debrief {
  return {
    ...debrief,
    endedEarly: "conduct",
    verdict: `The interviewer ended this interview early because of rude or hostile remarks. ${debrief.verdict}`.trim(),
    nextSteps: ["Stay calm and professional, even when a question frustrates you.", ...debrief.nextSteps],
  };
}
