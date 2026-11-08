import { type Debrief, turnScore } from "../voice/debrief";
import type { StoredTurn } from "../voice/store";
import { overlap, quoteTime, type Span, type TimedLine } from "./align";

export type MomentKind = "mistake" | "better" | "strength" | "filler";
export type Moment = {
  t: number;
  kind: MomentKind;
  title: string;
  detail: string;
  /** A rewrite in the person's own voice. */
  better?: string;
  /** What they actually said, quoted. */
  said?: string;
  question: string;
  turn: number;
};

const MISTAKE_BELOW = 55;
const STRONG_FROM = 75;
const FILLER_FROM = 3;
const SAID_MATCH = 0.5;
const QUESTION_MATCH = 0.6;
// on a tie in time, the problem comes before its fix
const ORDER: Record<MomentKind, number> = { mistake: 0, better: 1, strength: 2, filler: 3 };

const WEAKEST_TITLE: Record<string, string> = {
  structure: "The story lost its shape",
  relevance: "Drifted from the question",
  specificity: "Stayed too general",
  confidence: "Undersold yourself",
};

function weakestTitle(turn: StoredTurn) {
  const [weakest] = Object.entries(turn.scores).sort(([, a], [, b]) => a - b);
  return (weakest && WEAKEST_TITLE[weakest[0]]) ?? "This answer fell short";
}

// the report names moments in its own words; tie each to the answer it quotes, or failing that the question
function matchTurn(turns: StoredTurn[], said: string, moment: string): number {
  const best = (score: (turn: StoredTurn) => number, floor: number) => {
    const scored = turns.map((turn, i) => ({ i, score: score(turn) })).sort((a, b) => b.score - a.score)[0];
    return scored && scored.score >= floor ? scored.i : -1;
  };
  const bySaid = best((turn) => overlap(said, turn.answer), SAID_MATCH);
  return bySaid >= 0 ? bySaid : best((turn) => overlap(moment, turn.question), QUESTION_MATCH);
}

function answerMoments(turn: StoredTurn, i: number, report: Debrief | null, span: Span): Moment[] {
  const graded = report?.perQuestion[i];
  const score = graded?.score ?? turnScore(turn);
  const base = { t: span.start, question: turn.question, turn: i };
  const out: Moment[] = [];
  if (score !== null && score < MISTAKE_BELOW) {
    out.push({ ...base, kind: "mistake", title: weakestTitle(turn), detail: graded?.oneLineFeedback || turn.tip });
  } else if (!report && score !== null && score >= STRONG_FROM) {
    out.push({ ...base, kind: "strength", title: "Strong answer", detail: `This one scored ${score} out of 100.` });
  }
  if (turn.delivery.fillerWords >= FILLER_FROM) {
    out.push({ ...base, kind: "filler", title: `${turn.delivery.fillerWords} filler words`, detail: "Pause for a breath instead of saying \"um\" or \"like\"." });
  }
  return out;
}

function reportMoments(turns: StoredTurn[], report: Debrief, spans: Span[], lines: TimedLine[]): Moment[] {
  const at = (i: number, said: string) => ({ t: quoteTime(said, lines, spans[i]), question: turns[i].question, turn: i, said });
  const strengths = report.strengths.flatMap((s): Moment[] => {
    const i = matchTurn(turns, s.quote, "");
    return i < 0 ? [] : [{ ...at(i, s.quote), kind: "strength", title: "This worked", detail: s.why }];
  });
  const betters = report.improvements.flatMap((s): Moment[] => {
    const i = matchTurn(turns, s.said, s.moment);
    if (i < 0) return [];
    return [{ ...at(i, s.said), kind: "better", title: "A stronger way to say it", detail: s.better, ...(s.example ? { better: s.example } : {}) }];
  });
  return [...strengths, ...betters];
}

/** Every dot on the replay bar: what went wrong, how to say it better, what worked, and filler. */
export function buildMoments(turns: StoredTurn[], report: Debrief | null, spans: Span[], lines: TimedLine[]): Moment[] {
  const fromAnswers = turns.flatMap((turn, i) => answerMoments(turn, i, report, spans[i]));
  const fromReport = report ? reportMoments(turns, report, spans, lines) : [];
  return [...fromAnswers, ...fromReport].sort((a, b) => a.t - b.t || ORDER[a.kind] - ORDER[b.kind]);
}

/** Dots on the same second would sit on top of each other; push each later one a second along. */
export function separate(moments: Moment[], gapSec = 1): Moment[] {
  let last = -Infinity;
  return moments.map((moment) => {
    const t = Math.max(moment.t, last + gapSec);
    last = t;
    return { ...moment, t };
  });
}
