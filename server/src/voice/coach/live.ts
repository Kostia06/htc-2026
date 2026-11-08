import type { Env } from "../../env";
import { turnScore } from "../debrief";
import { saveLiveTip, type VoiceSession } from "../store";
import type { TurnScore } from "../score";
import { questionType, researchFor, sessionBudget } from "./research";
import { claimLiveTip } from "./session-store";
import { writeTip } from "./tip";

// the same bar the replay uses to call an answer a mistake
export const WEAK_BELOW = 55;
// "yeah" or "I don't know" has nothing in it to rewrite
const MIN_WORDS = 6;

type ScoredAnswer = { question: string; answer: string; score: TurnScore };

/** Code decides, not a model: a weak score on a real answer. */
export function needsTip(turn: ScoredAnswer) {
  const score = turnScore(turn.score);
  return score !== null && score < WEAK_BELOW && turn.answer.split(/\s+/).filter(Boolean).length >= MIN_WORDS;
}

function companyOf(session: VoiceSession) {
  return session.companySlug && session.plan.company ? { slug: session.companySlug, name: session.plan.company } : null;
}

/**
 * Runs in waitUntil after a turn is scored: for the session's first weak answer, reads what this company's
 * interviewers look for and rewrites the answer around it. Never throws; a missed tip only means no tip.
 */
export async function coachTurn(env: Env, userId: string, session: VoiceSession, idx: number, turn: ScoredAnswer) {
  try {
    if (!needsTip(turn) || !(await claimLiveTip(env, userId, session.id))) return;
    const company = companyOf(session);
    const pages = company ? await researchFor(env, company, session.plan.role, questionType(turn.question), sessionBudget()) : [];
    const tip = await writeTip(env, { company: company?.name ?? null, role: session.plan.role, question: turn.question, answer: turn.answer, pages });
    if (tip) await saveLiveTip(env, userId, session.id, idx, tip);
  } catch (error) {
    console.warn("voice live tip failed:", error instanceof Error ? error.message : error);
  }
}
