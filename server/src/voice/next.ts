import type { Env } from "../env";
import { followUpFor } from "./follow-up";
import type { VoicePlan } from "./types";

export const SPEAKERS = ["interviewer", "candidate"] as const;
export type TranscriptLine = { speaker: (typeof SPEAKERS)[number]; text: string };
export type NextLine = { say: string; kind: "follow_up" | "question" | "wrap_up" };

const WRAP_UP = "That's everything from me. Thanks so much, you'll hear from us soon.";

const plannedLines = (plan: VoicePlan) => plan.questions.map((q) => q.text);
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
  const moveOn: NextLine = upcoming ? { say: upcoming, kind: "question" } : { say: WRAP_UP, kind: "wrap_up" };
  if (!justAsked) return moveOn;

  const followUp = await followUpFor(env, { role: plan.role, question: lines[current], answer: turn.answer });
  return followUp ? { say: followUp, kind: "follow_up" } : moveOn;
}
