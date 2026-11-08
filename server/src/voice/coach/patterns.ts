import type { Env } from "../../env";
import { claimCooldown } from "../../memory/cooldowns";
import { remember } from "../../memory/private/store";
import { insertSteps, nextPosition } from "../../roadmap/store";
import type { StepContent } from "../../roadmap/types";
import { type DeliveryIssue, deliveryIssues } from "../habits";
import type { StoredTurn } from "../store";
import { countSessionsWithIssue, saveDeliveryIssues } from "./session-store";

// three sessions is a habit, not a bad day
export const PATTERN_SESSIONS = 3;
// once per person per habit: a claim that never expires
const ONCE_MS = 100 * 365 * 86_400_000;

type Habit = { memory: string; title: string; why: string; detail: string };

const HABITS: Record<DeliveryIssue, Habit> = {
  we: {
    memory: "In three practice interviews I said \"we\" far more than \"I\", so my own part got lost.",
    title: "Practise answering with I, not we",
    why: "In three practice interviews you said \"we\" far more than \"I\". Interviewers are hiring you, not your team.",
    detail: "Run one practice interview and tell each story in the first person: what you decided, built and changed.",
  },
  hedging: {
    memory: "In three practice interviews I hedged a lot (\"kind of\", \"maybe\", \"I guess\").",
    title: "Practise answering without hedging",
    why: "In three practice interviews you softened your answers with \"kind of\", \"maybe\" or \"I guess\".",
    detail: "Run one practice interview and state each point plainly. If you're unsure, say what you'd check, not \"maybe\".",
  },
  filler: {
    memory: "In three practice interviews I used a lot of filler words (\"um\", \"like\").",
    title: "Practise pausing instead of saying um",
    why: "In three practice interviews filler words crept into your answers.",
    detail: "Run one practice interview and take a breath where an \"um\" would go. A pause sounds more confident than you think.",
  },
  no_result: {
    memory: "In three practice interviews my longer answers ended without a result or a number.",
    title: "Practise ending every story with a result",
    why: "In three practice interviews your longer answers stopped before saying what changed.",
    detail: "Run one practice interview and finish each story with one number or outcome: time saved, users, a grade, a fix shipped.",
  },
};

function stepFor(habit: Habit): StepContent {
  return { kind: "interview_practice", title: habit.title, why: habit.why, detail: habit.detail, estimate: "15 min", label: "ready_now", action: { type: "interview" } };
}

async function noteHabit(env: Env, userId: string, issue: DeliveryIssue) {
  if ((await countSessionsWithIssue(env, userId, issue)) < PATTERN_SESSIONS) return;
  if (!(await claimCooldown(env, "delivery-habit", `${userId}:${issue}`, ONCE_MS))) return;
  const habit = HABITS[issue];
  await remember(env, userId, { kind: "weakness", text: habit.memory });
  await insertSteps(env, userId, await nextPosition(env, userId), [stepFor(habit)], "agent");
}

/** Called once a session finishes: records its habits, and turns a habit seen in three sessions into a note and one Road step. */
export async function notePatterns(env: Env, userId: string, sessionId: string, turns: StoredTurn[]) {
  try {
    const issues = [...new Set(turns.flatMap((turn) => deliveryIssues(turn.delivery)))];
    await saveDeliveryIssues(env, userId, sessionId, issues);
    for (const issue of issues) await noteHabit(env, userId, issue);
  } catch (error) {
    console.warn("voice delivery patterns failed:", error instanceof Error ? error.message : error);
  }
}
