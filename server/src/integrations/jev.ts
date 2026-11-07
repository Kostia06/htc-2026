import type { Env } from "../env";

const URL = "https://api.typesafe.ai/v1/systemone";
// Jev answers in ~100ms; anything slower means trouble, and callers have a fallback
const TIMEOUT_MS = 4000;

export const deps = { fetch: (input: RequestInfo, init?: RequestInit) => fetch(input, init) };

export type JevQuestion =
  | { type: "score"; instructions: string; criteria: string[] }
  | { type: "noul"; instructions: string }
  | { type: "choice"; instructions: string; criteria: Record<string, string> };

export type JevAnswer =
  | { type: "score"; score: number; confidence: number }
  | { type: "noul"; noul: number }
  | { type: "choice"; choice: string; confidence: number };

export async function askJev(env: Env, state: unknown, questions: Record<string, JevQuestion>): Promise<Record<string, JevAnswer>> {
  if (!env.JEV_API_KEY) throw new Error("jev is not configured");
  const res = await deps.fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.JEV_API_KEY}` },
    body: JSON.stringify({ model: "jev-latest", state, questions }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`jev ${res.status}`);
  const { answers } = await res.json<{ answers?: Record<string, JevAnswer> }>();
  if (!answers) throw new Error("jev returned no answers");
  return answers;
}
