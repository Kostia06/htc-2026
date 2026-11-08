import { deliveryIssues, type DeliveryIssue } from "../voice/habits";
import type { StoredTurn } from "../voice/store";
import type { Span } from "./align";
import type { Moment } from "./moments";

type Base = Pick<Moment, "t" | "question" | "turn">;

// filler already has its own dot, older than these
function habitMoment(issue: Exclude<DeliveryIssue, "filler">, turn: StoredTurn, base: Base): Moment {
  const d = turn.delivery;
  const copy: Record<typeof issue, { title: string; detail: string }> = {
    hedging: { title: `Hedged ${d.hedges ?? 0} times`, detail: "Words like \"maybe\" and \"kind of\" make a good answer sound unsure. Say it plainly." },
    we: { title: `"We" ${d.weCount ?? 0} times, "I" ${d.iCount ?? 0}`, detail: "They're hiring you, not the team. Say what you did: \"I built\", \"I decided\"." },
    no_result: { title: "No result or number", detail: "The story stopped before what changed. End with one number or outcome." },
  };
  return { ...base, kind: "delivery", ...copy[issue] };
}

function tipMoment(turn: StoredTurn, base: Base): Moment[] {
  const tip = turn.liveTip;
  if (!tip) return [];
  const shared = { ...base, detail: tip.why, better: tip.rewrite, said: tip.said };
  return tip.kind === "researched" && tip.sources.length > 0
    ? [{ ...shared, kind: "researched", title: "How their interviewers hear it", sources: tip.sources }]
    : [{ ...shared, kind: "better", title: "Coaching tip" }];
}

/** The dots written during the call: delivery habits counted in code, and the live tip for a weak answer. */
export function coachMoments(turn: StoredTurn, i: number, span: Span): Moment[] {
  const base = { t: span.start, question: turn.question, turn: i };
  const habits = deliveryIssues(turn.delivery).flatMap((issue) => (issue === "filler" ? [] : [habitMoment(issue, turn, base)]));
  return [...tipMoment(turn, base), ...habits];
}
