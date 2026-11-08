import type { Env } from "../env";
import type { FeedAction, FeedCard } from "./types";

export type ActionHistory = { dismissed: Set<string>; avoidTags: string[] };

// what the next build must leave out, and the tags it should lean away from
export async function actionHistory(env: Env, userId: string): Promise<ActionHistory> {
  const { results } = await env.DB.prepare("SELECT item_id, card FROM feed_actions WHERE user_id = ? AND action = 'dismiss'")
    .bind(userId)
    .all<{ item_id: string; card: string }>();
  const tags = new Set(results.flatMap((r) => (JSON.parse(r.card) as FeedCard).tags ?? []));
  return { dismissed: new Set(results.map((r) => r.item_id)), avoidTags: [...tags] };
}

// the card as the person last saw it: in their feed, or among what they already saved or dismissed
export async function findCard(env: Env, userId: string, id: string): Promise<FeedCard | null> {
  const row = await env.DB.prepare(
    `SELECT card FROM feed_items WHERE user_id = ?1 AND json_extract(card, '$.id') = ?2
     UNION ALL SELECT card FROM feed_actions WHERE user_id = ?1 AND item_id = ?2 LIMIT 1`,
  )
    .bind(userId, id)
    .first<{ card: string }>();
  return row ? (JSON.parse(row.card) as FeedCard) : null;
}

// a dismissed card leaves every section at once and marks the feed for a rebuild, so the nudge shows on the next page load
export async function applyAction(env: Env, userId: string, card: FeedCard, action: FeedAction, now: Date) {
  const { saved: _saved, ...stored } = card;
  const statements = [
    env.DB.prepare(
      `INSERT INTO feed_actions (user_id, item_id, action, card, created_at) VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT (user_id, item_id) DO UPDATE SET action = ?3, card = ?4, created_at = ?5`,
    ).bind(userId, card.id, action, JSON.stringify(stored), now.toISOString()),
  ];
  if (action === "dismiss") {
    statements.push(
      env.DB.prepare("DELETE FROM feed_items WHERE user_id = ? AND json_extract(card, '$.id') = ?").bind(userId, card.id),
      env.DB.prepare("UPDATE feed_state SET built_at = NULL WHERE user_id = ?").bind(userId),
    );
  }
  await env.DB.batch(statements);
}
