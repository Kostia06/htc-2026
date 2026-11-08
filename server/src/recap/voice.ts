import { db } from "../db";
import type { Env } from "../env";
import { voiceProvider, type StartedVoice } from "../voice/providers";

export const RECAP_OPENING = "How did your interview go? Tell me like you'd tell a friend.";

/** What the voice agent is told for a recap call: listen first, two short questions at most, then wrap up. */
export function recapInstructions(companyName?: string) {
  const company = companyName ? `They interviewed at ${companyName}; you already know the company, never ask which one.` : "";
  return [
    "You are Skillit, a friendly career mentor in Calgary. The person just finished a real job interview and is telling you how it went, like they'd tell a friend.",
    "Listen first. Let them talk; a short pause is thinking, not the end. React briefly and warmly, never lecture or give advice.",
    `You want to learn: the company, the role, the round (phone screen, technical, behavioural, final) and the actual questions they were asked. ${company}`.trim(),
    "Ask at most two short clarifying questions in the whole call, and only when the company, the role or the questions are still missing. Never ask about anything else.",
    "Every line under 20 words, one question at a time, plain spoken words, no lists.",
    'When you have what you need, or they say "that\'s it", thank them in one sentence, say you\'ll share the questions anonymously with others preparing for the same interview, and say goodbye.',
  ].join("\n");
}

export type RecapVoiceStart = { sessionId: string; opening: string } & StartedVoice;

export async function startRecapVoice(env: Env, userId: string, company?: { slug: string; name: string }): Promise<RecapVoiceStart> {
  const started = await voiceProvider(env).startSession(env, { instructions: recapInstructions(company?.name), opening: RECAP_OPENING });
  const sessionId = crypto.randomUUID();
  await db(env).prepare("INSERT INTO recap_voice_sessions (id, user_id, company_slug, created_at) VALUES (?, ?, ?, ?)")
    .bind(sessionId, userId, company?.slug ?? null, new Date().toISOString())
    .run();
  return { sessionId, opening: RECAP_OPENING, ...started };
}

export type RecapVoiceSession = { id: string; companySlug?: string; finishedAt: string | null };

/** Only the owner's row comes back: user_id is in the WHERE, not checked afterwards. */
export async function findRecapVoice(env: Env, userId: string, id: string): Promise<RecapVoiceSession | null> {
  const row = await db(env).prepare("SELECT id, company_slug, finished_at FROM recap_voice_sessions WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .first<{ id: string; company_slug: string | null; finished_at: string | null }>();
  return row ? { id: row.id, companySlug: row.company_slug ?? undefined, finishedAt: row.finished_at } : null;
}

export async function finishRecapVoice(env: Env, userId: string, id: string) {
  await db(env).prepare("UPDATE recap_voice_sessions SET finished_at = ? WHERE id = ? AND user_id = ?").bind(new Date().toISOString(), id, userId).run();
}
