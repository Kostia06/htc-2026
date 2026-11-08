import { MAX_CLARIFYING_TURNS, type RecapMessage } from "../agents/interview/skills/interview-recap";

const MAX_MESSAGES = 40;
const MAX_TEXT = 4000;
const MAX_TRANSCRIPT_LINES = 120;

const ROLES = new Set(["user", "raven"]);
// the voice transcript names speakers the way the practice sessions do; the app's chat uses user/raven
const USER_SPEAKERS = new Set(["user", "candidate", "person"]);
const RAVEN_SPEAKERS = new Set(["raven", "interviewer", "agent"]);

const isText = (value: unknown, max: number): value is string => typeof value === "string" && value.length <= max;

/** The chat history the app sends back on every turn, checked at the boundary. Null when it isn't a history. */
export function parseHistory(value: unknown): RecapMessage[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_MESSAGES) return null;
  const valid = value.every((m) => ROLES.has(m?.role) && isText(m?.text, MAX_TEXT));
  return valid ? value.map((m) => ({ role: m.role, text: m.text })) : null;
}

/** A voice transcript turned into the same history shape. Null when it isn't a transcript. */
export function parseTranscript(value: unknown): RecapMessage[] | null {
  if (!Array.isArray(value) || value.length > MAX_TRANSCRIPT_LINES) return null;
  const messages: RecapMessage[] = [];
  for (const line of value) {
    const speaker = typeof line?.speaker === "string" ? line.speaker.toLowerCase() : "";
    if (!isText(line?.text, MAX_TEXT)) return null;
    if (USER_SPEAKERS.has(speaker)) messages.push({ role: "user", text: line.text });
    else if (RAVEN_SPEAKERS.has(speaker)) messages.push({ role: "raven", text: line.text });
    else return null;
  }
  return messages;
}

/** Raven's lines after the person first spoke are the clarifying questions already asked; the opening line is free. */
export function clarifyingQuestionsLeft(messages: RecapMessage[]) {
  const firstUser = messages.findIndex((m) => m.role === "user");
  if (firstUser < 0) return MAX_CLARIFYING_TURNS;
  const asked = messages.slice(firstUser).filter((m) => m.role === "raven").length;
  return Math.max(0, MAX_CLARIFYING_TURNS - asked);
}

export const hasSomethingToSay = (messages: RecapMessage[]) => messages.some((m) => m.role === "user" && m.text.trim().length > 0);
