export type TimedLine = { t: number; speaker: "agent" | "person"; text: string };
/** Seconds into the call where an answer starts and where the interviewer picks up again. */
export type Span = { start: number; end: number };

// a person line counts as part of an answer when most of its words are in the answer we scored;
// the two transcripts come from the same speech but can differ in a word or two
const MATCH = 0.6;
const QUOTE_MATCH = 0.5;

const words = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

/** Share of `line`'s words that also appear in `text`, 0 to 1. */
export function overlap(line: string, text: string): number {
  const lineWords = words(line);
  if (lineWords.length === 0) return 0;
  const known = new Set(words(text));
  return lineWords.filter((w) => known.has(w)).length / lineWords.length;
}

function findAnswer(answer: string, lines: TimedLine[], from: number) {
  const belongs = (line: TimedLine | undefined) => line?.speaker === "person" && overlap(line.text, answer) >= MATCH;
  const first = lines.findIndex((line, i) => i >= from && belongs(line));
  if (first < 0) return null;
  let last = first;
  while (belongs(lines[last + 1])) last++;
  return { first, last };
}

// an answer the transcript didn't catch sits between the answers around it, sharing that gap evenly
function fillGaps(spans: (Span | null)[], durationSec: number): Span[] {
  return spans.map((span, i) => {
    if (span) return span;
    let before = i - 1;
    while (before >= 0 && !spans[before]) before--;
    let after = i + 1;
    while (after < spans.length && !spans[after]) after++;
    const from = before >= 0 ? spans[before]!.end : 0;
    const to = after < spans.length ? spans[after]!.start : durationSec;
    const slot = (to - from) / (after - before - 1);
    const position = i - before - 1;
    return { start: from + slot * position, end: from + slot * (position + 1) };
  });
}

/** Where each scored answer happened in the call, matched in order so a repeated phrase can't jump back in time. */
export function alignTurns(turns: { answer: string }[], lines: TimedLine[], durationSec: number): Span[] {
  let cursor = 0;
  const found = turns.map((turn): Span | null => {
    const match = findAnswer(turn.answer, lines, cursor);
    if (!match) return null;
    cursor = match.last + 1;
    return { start: lines[match.first].t, end: lines[match.last + 1]?.t ?? durationSec };
  });
  return fillGaps(found, durationSec);
}

/** When, inside an answer, the person said `quote`; the answer's start when the quote can't be found. */
export function quoteTime(quote: string, lines: TimedLine[], span: Span): number {
  let best: { t: number; score: number } | null = null;
  for (const line of lines) {
    if (line.speaker !== "person" || line.t < span.start || line.t >= span.end) continue;
    // the quote is usually shorter than the line, so measure how much of the quote the line holds
    const score = overlap(quote, line.text);
    if (score >= QUOTE_MATCH && (!best || score > best.score)) best = { t: line.t, score };
  }
  return best?.t ?? span.start;
}
