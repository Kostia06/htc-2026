// Delivery habits an interviewer notices, counted in code from the answer text: free, instant, the same everywhere.

export type Habits = { hedges: number; weCount: number; iCount: number; hasResult: boolean };
export type DeliveryIssue = "hedging" | "we" | "filler" | "no_result";
export const DELIVERY_ISSUES: DeliveryIssue[] = ["hedging", "we", "filler", "no_result"];

const HEDGES = /\b(i guess|kind of|sort of|maybe|probably|i'm not sure|not really sure|i suppose|hopefully|i think maybe)\b/gi;
const WE = /\b(we|we're|we've|we'd|our|ours|us)\b/gi;
const I = /\b(i|i'm|i've|i'd|i'll|my|mine|me)\b/gi;
// a number, a percentage or a size word: the evidence that something actually changed
const RESULT = /\d|%|\b(percent|half|double[ds]?|twice|tripled?|hundreds?|thousands?|millions?|one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty)\b/i;

const count = (text: string, pattern: RegExp) => text.match(pattern)?.length ?? 0;

export function measureHabits(answer: string): Habits {
  return { hedges: count(answer, HEDGES), weCount: count(answer, WE), iCount: count(answer, I), hasResult: RESULT.test(answer) };
}

// thresholds sit where one slip is ignored and a habit is not: a single "maybe" is fine, three hedges are a pattern
const HEDGES_FROM = 2;
const WE_FROM = 3;
const FILLER_FROM = 3;
// a short answer without a number is often just an answer; a long story without one is missing its result
const RESULT_EXPECTED_FROM_WORDS = 40;

type Measured = { words: number; fillerWords: number } & Partial<Habits>;

/** The habits worth flagging in one answer. Turns stored before habits were measured flag only filler. */
export function deliveryIssues(delivery: Measured): DeliveryIssue[] {
  const issues: DeliveryIssue[] = [];
  if ((delivery.hedges ?? 0) >= HEDGES_FROM) issues.push("hedging");
  const we = delivery.weCount ?? 0;
  if (we >= WE_FROM && we > 2 * (delivery.iCount ?? 0)) issues.push("we");
  if (delivery.fillerWords >= FILLER_FROM) issues.push("filler");
  if (delivery.hasResult === false && delivery.words >= RESULT_EXPECTED_FROM_WORDS) issues.push("no_result");
  return issues;
}
