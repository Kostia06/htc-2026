import { db } from "../../db";
import type { Env } from "../../env";
import type { DeliveryIssue } from "../habits";

/** True for the first caller only: a session gets one live tip, however many weak answers it has. */
export async function claimLiveTip(env: Env, userId: string, sessionId: string, now = new Date()) {
  const result = await db(env).prepare("UPDATE voice_sessions SET live_tip_claimed_at = ? WHERE id = ? AND user_id = ? AND live_tip_claimed_at IS NULL")
    .bind(now.toISOString(), sessionId, userId)
    .run();
  return result.meta.changes > 0;
}

export async function saveDeliveryIssues(env: Env, userId: string, sessionId: string, issues: DeliveryIssue[]) {
  await db(env).prepare("UPDATE voice_sessions SET delivery_issues = ? WHERE id = ? AND user_id = ?")
    .bind(JSON.stringify(issues), sessionId, userId)
    .run();
}

// labels are stored as a JSON array of fixed words, so a quoted match can't hit part of another label
export async function countSessionsWithIssue(env: Env, userId: string, issue: DeliveryIssue) {
  const row = await db(env).prepare("SELECT COUNT(*) AS n FROM voice_sessions WHERE user_id = ? AND delivery_issues LIKE ?")
    .bind(userId, `%"${issue}"%`)
    .first<{ n: number }>();
  return Number(row?.n ?? 0);
}
