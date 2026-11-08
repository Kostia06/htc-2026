import { db } from "../db";
import type { Env } from "../env";

// every table that holds something about one person, keyed by user_id; shared knowledge (companies, postings) is untouched
export const USER_TABLES = [
  "user_profiles",
  "user_memories",
  "roadmap_steps",
  "feed_items",
  "feed_state",
  "voice_sessions",
  "voice_turns",
  "user_documents",
  "agent_runs",
  "pairing_offers",
  "feed_actions",
  "user_resumes",
  "headset_devices",
  "headset_launches",
  "user_postings",
  "user_tailored_resumes",
  "user_notifications",
  "notification_settings",
  "notification_devices",
  "road_pattern_votes",
  "path_outcomes",
] as const;

export type UserTable = (typeof USER_TABLES)[number];

// one batch, so a failure part-way can't leave a half-erased account behind
export async function eraseUserData(env: Env, userId: string): Promise<Record<UserTable, number>> {
  const results = await db(env).batch(USER_TABLES.map((table) => db(env).prepare(`DELETE FROM ${table} WHERE user_id = ?`).bind(userId)));
  return Object.fromEntries(USER_TABLES.map((table, i) => [table, results[i]?.meta.changes ?? 0])) as Record<UserTable, number>;
}
