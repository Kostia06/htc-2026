import type { Debrief } from "./debrief";
import type { StoredTurn } from "./store";

// The interviewer always closes with this question (voice/instructions.ts); whatever the person says
// after it is their chance to show curiosity about the company, which interviewers notice.
const CLOSING_QUESTION = /any questions for me/i;
const ASKS = /\?|\b(what|how|who|when|where|why|which|could you|can you|do you|does|is there|are there|wondering|curious)\b/i;
const DECLINES = /^\s*(no|nope|nah|not really|nothing|i'?m good|i think i'?m good|i don'?t think so)\b/i;
const MAX_QUOTE = 120;

export const INTEREST_WHY = "Showed interest: asking about the company at the end tells them you're curious and serious about the role.";
export const INTEREST_STEP = "Show interest: prepare two questions about the company or the team to ask when they invite yours.";

export type Interest = { asked: boolean; quote: string | null };

function firstQuestion(answer: string): string {
  const sentence = answer.split(/(?<=[.!?])\s/).find((s) => ASKS.test(s)) ?? answer;
  return sentence.trim().slice(0, MAX_QUOTE);
}

/** Null when the closing question was never reached (the call ended early), so there is nothing to note. */
export function curiosityOf(turns: Pick<StoredTurn, "question" | "answer">[]): Interest | null {
  const start = turns.findIndex((turn) => CLOSING_QUESTION.test(turn.question));
  if (start === -1) return null;
  // the person may ask several, each answered and followed by "Anything else?"
  const asked = turns.slice(start).find((turn) => {
    const words = turn.answer.split(/\s+/).filter(Boolean).length;
    if (DECLINES.test(turn.answer) && words < 8) return false;
    return ASKS.test(turn.answer) && words >= 4;
  });
  return asked ? { asked: true, quote: firstQuestion(asked.answer) } : { asked: false, quote: null };
}

/** Adds a "Showed interest" strength, or a tip to prepare questions, from what they said after the closing question. */
export function withInterest(report: Debrief, turns: Pick<StoredTurn, "question" | "answer">[]): Debrief {
  const interest = curiosityOf(turns);
  if (!interest) return report;
  if (interest.asked && interest.quote) {
    return { ...report, interest, strengths: [...report.strengths, { quote: interest.quote, why: INTEREST_WHY }] };
  }
  return { ...report, interest, nextSteps: [...report.nextSteps, INTEREST_STEP] };
}
