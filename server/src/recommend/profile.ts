import type { ToolCallRecord } from "../agents/core/loop";

export type ProfileSnapshot = { text: string; goals: string[] };

// evidence is checked against what the profile tools returned during the run, not against what the model says it saw
export type ProfileReader = (toolCalls: ToolCallRecord[]) => ProfileSnapshot;

const PROFILE_TOOLS = new Set(["profile", "recall"]);
const GOAL_KEYS = new Set(["goal", "goals"]);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

// the profile tool is built elsewhere, so this relies on no particular shape: every string it returned counts
export const readProfileFromToolCalls: ProfileReader = (toolCalls) => {
  const results = toolCalls.filter((c) => PROFILE_TOOLS.has(c.name) && !(isRecord(c.result) && "error" in c.result)).map((c) => c.result);
  return { text: stringsIn(results).join("\n"), goals: goalsIn(results) };
};

function stringsIn(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (isRecord(value)) return Object.values(value).flatMap(stringsIn);
  return [];
}

// goals are a "goals" field on the profile or recalled memories of kind goal
function goalsIn(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(goalsIn);
  if (!isRecord(value)) return [];
  if (value.kind === "goal" && typeof value.text === "string") return [value.text];
  return Object.entries(value).flatMap(([key, inner]) => (GOAL_KEYS.has(key) ? stringsIn(inner) : goalsIn(inner)));
}
