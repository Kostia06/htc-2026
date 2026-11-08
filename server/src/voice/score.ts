import type { Env } from "../env";
import { askJev, type JevQuestion } from "../integrations/jev";
import { type Delivery, measureDelivery } from "./delivery";

export type Turn = { question: string; answer: string; durationMs: number };
export type TurnScore = { scores: Record<string, number>; delivery: Delivery; tip: string };

type Dimension = { question: JevQuestion; tip: string };

const level = (instructions: string, criteria: string[]): JevQuestion => ({ type: "score", instructions, criteria });

const INTERVIEW: Record<string, Dimension> = {
  structure: {
    question: level("How well is `answer` structured as a story that answers `question`?", [
      "No structure: scattered points or no real story",
      "Some order, but the situation or the result is missing",
      "Situation, action and result are all there but thin",
      "Clear situation, what they did, and what came of it",
      "Tight story: context, their own actions, a concrete result and what they learned",
    ]),
    tip: "Open with the situation in one sentence, then what you did, then how it turned out.",
  },
  relevance: {
    question: level("How directly does `answer` respond to `question`?", [
      "Talks about something else",
      "Touches the question only in passing",
      "Answers part of the question",
      "Answers the question",
      "Answers exactly what was asked and ties it back to the role",
    ]),
    tip: "Answer the exact question in your first sentence, then back it up.",
  },
  specificity: {
    question: level("How specific and evidenced is `answer`?", [
      "Only general claims",
      "Mostly general, one vague example",
      "One real example with few details",
      "Concrete example with names of tools, people or numbers",
      "Concrete, measurable details that prove the claim",
    ]),
    tip: "Add one concrete detail: a number, a tool, or what changed because of you.",
  },
  confidence: {
    question: level("How confident and ownership-taking is the language in `answer`?", [
      "Apologetic or dismissive of their own work",
      "Hedges most statements",
      "Neutral",
      "Owns their part clearly",
      "Owns their part clearly and credits others fairly",
    ]),
    tip: "Say \"I\" for what you did yourself, and skip phrases like \"I guess\" or \"kind of\".",
  },
};

function deliveryTip(delivery: Delivery) {
  if (delivery.fillerWords >= 2) return "Pause for a breath instead of saying \"um\" or \"like\".";
  if (delivery.wordsPerMinute && delivery.wordsPerMinute > 170) return "Slow down a little so each point lands.";
  return "Keep going: take a breath before each answer and start with the main point.";
}

function weakestTip(scores: Record<string, number>) {
  const [weakest] = Object.entries(scores).sort(([, a], [, b]) => a - b);
  return weakest ? INTERVIEW[weakest[0]].tip : undefined;
}

// Jev rates on 0–4; people read 1–5
const toFivePoint = (score: number) => Math.round((score + 1) * 10) / 10;

// The fast path for live feedback: one Jev request, no LLM. If Jev is unreachable the turn still
// gets the delivery numbers, because a practice session must never stall on scoring.
export async function scoreTurn(env: Env, turn: Turn): Promise<TurnScore> {
  const delivery = measureDelivery(turn.answer, turn.durationMs);
  try {
    const questions = Object.fromEntries(Object.entries(INTERVIEW).map(([key, d]) => [key, d.question]));
    const answers = await askJev(env, { question: turn.question, answer: turn.answer }, questions);
    const scores = Object.fromEntries(
      Object.keys(INTERVIEW).flatMap((key) => {
        const answer = answers[key];
        return answer?.type === "score" ? [[key, toFivePoint(answer.score)]] : [];
      }),
    );
    return { scores, delivery, tip: weakestTip(scores) ?? deliveryTip(delivery) };
  } catch {
    return { scores: {}, delivery, tip: deliveryTip(delivery) };
  }
}
