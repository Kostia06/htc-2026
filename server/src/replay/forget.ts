import type { Env } from "../env";
import { KEEP_DAYS } from "../voice/store";
import { deleteConversation } from "./elevenlabs";
import { conversationsBefore, conversationsOfUser } from "./store";

/** Deletes recordings at ElevenLabs. Returns how many could not be deleted, so callers can decide what that means. */
export async function forgetRecordings(env: Env, conversationIds: string[]): Promise<number> {
  if (conversationIds.length === 0) return 0;
  const results = await Promise.allSettled(conversationIds.map((id) => deleteConversation(env, id)));
  const failed = results.filter((r) => r.status === "rejected" || !r.value).length;
  if (failed > 0) console.warn(`voice replay: ${failed} of ${conversationIds.length} recordings could not be deleted at ElevenLabs`);
  return failed;
}

export const forgetUserRecordings = async (env: Env, userId: string) => forgetRecordings(env, await conversationsOfUser(env, userId));

// runs just before the 30-day sweep removes the sessions, so the recordings don't outlive the only link to them
export async function forgetExpiredRecordings(env: Env, now = new Date()) {
  const cutoff = new Date(now.getTime() - KEEP_DAYS * 86_400_000).toISOString();
  const ids = await conversationsBefore(env, cutoff);
  return ids.length - (await forgetRecordings(env, ids));
}
