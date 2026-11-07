import type { Env } from "../env";
import { submitExperience } from "./experiences";
import { findMemory } from "./private/store";

export type ShareRefusal = "not_found" | "not_a_note" | "invalid" | "unknown_company" | "rate_limited";
export type ShareResult = { shared: true } | { shared: false; reason: ShareRefusal };

const REFUSAL_BY_STATUS = { 400: "invalid", 404: "unknown_company", 429: "rate_limited" } as const;

// Sharing publishes a scrubbed copy through the same path as a hand-written report. The private memory is left untouched.
export async function shareMemory(
  env: Env,
  userId: string,
  memoryId: string,
  target: { companySlug: string; role: string },
): Promise<ShareResult> {
  const memory = await findMemory(env, userId, memoryId);
  if (!memory) return { shared: false, reason: "not_found" };
  if (memory.kind !== "note") return { shared: false, reason: "not_a_note" };

  const result = await submitExperience(env, userId, { companySlug: target.companySlug, role: target.role, questions: [memory.text] });
  if (result.status === 201) return { shared: true };
  return { shared: false, reason: REFUSAL_BY_STATUS[result.status] };
}
