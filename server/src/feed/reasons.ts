import { FIELD_LABELS } from "./fields";
import type { Candidate, FeedCriteria, FeedField } from "./types";

export const MAX_REASONS = 3;
export const MAX_REASON_LENGTH = 60;

// an item that says it welcomes people who are starting out
const BEGINNER_TERMS = /\b(beginner|beginners|beginner[- ]friendly|no experience|first[- ]time|first[- ]timers|newcomer|newcomers|intro|introductory|introduction)\b/i;
const ENTRY_LEVEL_TERMS = /\b(entry[- ]level|junior|intern|internship|new grad|new graduate|graduate program)\b/i;
// the same AI vocabulary the criteria look for in the profile
const AI_TERMS = /\b(ai|ml|llm|llms|gpt|chatgpt|copilot|claude|gemini|openai|langchain|machine learning|generative|genai|neural)\b/i;

const shortDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const wordsOf = (text: string) => text.toLowerCase().match(/[a-z0-9+#]+/g) ?? [];
const listed = (names: string[]) => (names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

// what the ranker already worked out about this item, so the reasons agree with the score
export type Matches = { role?: string; skills: string[]; field?: FeedField; near: boolean; daysUntil?: number; upcomingDays: number };

const clip = (text: string) => (text.length <= MAX_REASON_LENGTH ? text : `${text.slice(0, MAX_REASON_LENGTH - 1).trimEnd()}…`);

const itemText = (candidate: Candidate) => `${candidate.card.title}\n${candidate.text}\n${(candidate.card.tags ?? []).join(" ")}`;

function pastWorkReason(candidate: Candidate, criteria: FeedCriteria) {
  const words = new Set(wordsOf(itemText(candidate)));
  const match = (criteria.work ?? []).find((w) => w.words.some((word) => words.has(word)));
  return match && `Fits ${match.label}`;
}

function levelReason(candidate: Candidate, criteria: FeedCriteria) {
  if (!criteria.earlyCareer) return undefined;
  const text = itemText(candidate);
  if (candidate.card.kind === "job") return ENTRY_LEVEL_TERMS.test(text) ? "Entry level, a good first role" : undefined;
  const beginner = candidate.card.level === "beginner" || (candidate.card.tags ?? []).includes("beginner") || BEGINNER_TERMS.test(text);
  return beginner ? `Beginner friendly, good first ${candidate.card.kind}` : undefined;
}

const aiReason = (candidate: Candidate, criteria: FeedCriteria) => (criteria.usesAI && AI_TERMS.test(itemText(candidate)) ? "Uses AI like you do" : undefined);

// the strongest, most personal reasons first: a goal, then skills and work of theirs, then fit, then place and time
export function reasonsFor(candidate: Candidate, criteria: FeedCriteria, matches: Matches): string[] {
  const soon = matches.daysUntil !== undefined && matches.daysUntil <= matches.upcomingDays;
  const all = [
    matches.role && `Fits your goal: ${matches.role}`,
    matches.skills.length > 0 && `Uses ${listed(matches.skills)} from your profile`,
    matches.field && matches.field !== "general" && `In your field: ${FIELD_LABELS[matches.field]}`,
    pastWorkReason(candidate, criteria),
    levelReason(candidate, criteria),
    aiReason(candidate, criteria),
    matches.near && `Near you in ${criteria.location}`,
    soon && `Coming up ${shortDay.format(Date.parse(candidate.startsAt ?? ""))}`,
  ];
  return all.filter((r): r is string => typeof r === "string").slice(0, MAX_REASONS).map(clip);
}
