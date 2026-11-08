import type { Env } from "../env";
import { followUpFor } from "./follow-up";
import type { VoicePlan } from "./types";

export const SPEAKERS = ["interviewer", "candidate"] as const;
export type TranscriptLine = { speaker: (typeof SPEAKERS)[number]; text: string };
export type NextLine = { say: string; kind: "follow_up" | "question" | "wrap_up" };

// networking plans carry talking points, not questions, so Sam keeps the chat going with these
const NETWORKING_LINES = [
  "So what are you working on these days?",
  "Nice. What kind of role are you hoping to land next?",
  "Have you been to many meetups around Calgary?",
  "Is there anyone here you were hoping to meet?",
];

const WRAP_UP = {
  interview: "That's everything from me. Thanks so much, you'll hear from us soon.",
  networking: "Anyway, I should go grab a drink. Really nice meeting you!",
};

const plannedLines = (plan: VoicePlan) => (plan.mode === "interview" ? plan.questions.map((q) => q.text) : NETWORKING_LINES);
const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// The client sends the whole transcript, so the server keeps no turn state: where we are is read from
// which planned lines the interviewer has already said, and whether the last thing said was one of them.
function locate(lines: string[], transcript: TranscriptLine[]) {
  const said = transcript.filter((line) => line.speaker === "interviewer").map((line) => normalize(line.text));
  const current = lines.reduce((latest, line, i) => (said.includes(normalize(line)) ? i : latest), -1);
  const lastSaid = said.at(-1);
  return { current, justAsked: current >= 0 && lastSaid === normalize(lines[current]) };
}

export async function nextLine(env: Env, plan: VoicePlan, turn: { answer: string; transcript: TranscriptLine[] }): Promise<NextLine> {
  const lines = plannedLines(plan);
  const { current, justAsked } = locate(lines, turn.transcript);
  const upcoming = lines[current + 1];
  const moveOn: NextLine = upcoming ? { say: upcoming, kind: "question" } : { say: WRAP_UP[plan.mode], kind: "wrap_up" };
  if (!justAsked) return moveOn;

  const followUp = await followUpFor(env, { mode: plan.mode, role: plan.role, question: lines[current], answer: turn.answer });
  return followUp ? { say: followUp, kind: "follow_up" } : moveOn;
}
