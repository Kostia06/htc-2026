import type { Env } from "../env";
import type { FeedCard, FeedSection, RankedSection } from "./types";

const STALE_MS = 6 * 60 * 60 * 1000;
// a build that hasn't finished in this long has died with its request; another may take over
const CLAIM_TIMEOUT_MS = 2 * 60 * 1000;
// D1 allows 100 bound values per statement; four per row
const ROWS_PER_INSERT = 25;

export type FeedState = { builtAt: string | null; buildingSince: string | null; profileUpdatedAt: string | null };

type StateRow = { built_at: string | null; building_since: string | null; profile_updated_at: string | null };

const parseCards = (rows: unknown[]) => (rows as { card: string }[]).map((r) => JSON.parse(r.card) as FeedCard);

// one round trip: the page itself, which cards the person saved, and what's needed to decide whether to rebuild
export async function readFeed(env: Env, userId: string, section: FeedSection, offset: number, limit: number) {
  const items =
    section === "saved"
      ? env.DB.prepare("SELECT card FROM feed_actions WHERE user_id = ? AND action = 'save' ORDER BY created_at DESC, item_id LIMIT ? OFFSET ?").bind(userId, limit + 1, offset)
      : // one extra row tells us whether there is a next page without a COUNT
        env.DB.prepare("SELECT card FROM feed_items WHERE user_id = ? AND section = ? AND position >= ? ORDER BY position LIMIT ?").bind(userId, section, offset, limit + 1);
  const [state, page, saved] = await env.DB.batch([
    env.DB.prepare(
      `SELECT s.built_at, s.building_since, p.updated_at AS profile_updated_at
       FROM (SELECT ?1 AS user_id) AS me
       LEFT JOIN feed_state s ON s.user_id = me.user_id
       LEFT JOIN user_profiles p ON p.user_id = me.user_id`,
    ).bind(userId),
    items,
    env.DB.prepare("SELECT item_id FROM feed_actions WHERE user_id = ? AND action = 'save'").bind(userId),
  ]);
  const row = (state.results[0] ?? {}) as Partial<StateRow>;
  const savedIds = new Set((saved.results as { item_id: string }[]).map((r) => r.item_id));
  const cards = parseCards(page.results).map((card) => (savedIds.has(card.id) ? { ...card, saved: true } : card));
  return {
    cards: cards.slice(0, limit),
    hasMore: cards.length > limit,
    state: { builtAt: row.built_at ?? null, buildingSince: row.building_since ?? null, profileUpdatedAt: row.profile_updated_at ?? null },
  };
}

export function isStale(state: FeedState, now: Date) {
  if (!state.builtAt) return true;
  if (state.profileUpdatedAt && state.profileUpdatedAt > state.builtAt) return true;
  return now.getTime() - Date.parse(state.builtAt) > STALE_MS;
}

export function isBuilding(state: FeedState, now: Date) {
  return state.buildingSince !== null && now.getTime() - Date.parse(state.buildingSince) < CLAIM_TIMEOUT_MS;
}

// true only for the one caller that should run the rebuild
export async function claimRebuild(env: Env, userId: string, now: Date) {
  const result = await env.DB.prepare(
    `INSERT INTO feed_state (user_id, built_at, building_since) VALUES (?1, NULL, ?2)
     ON CONFLICT (user_id) DO UPDATE SET building_since = ?2
     WHERE feed_state.building_since IS NULL OR feed_state.building_since < ?3`,
  )
    .bind(userId, now.toISOString(), new Date(now.getTime() - CLAIM_TIMEOUT_MS).toISOString())
    .run();
  return result.meta.changes > 0;
}

export async function releaseClaim(env: Env, userId: string) {
  await env.DB.prepare("UPDATE feed_state SET building_since = NULL WHERE user_id = ?").bind(userId).run();
}

function insertStatements(env: Env, userId: string, sections: Record<RankedSection, FeedCard[]>) {
  const rows = Object.entries(sections).flatMap(([section, cards]) => cards.map((card, position) => [userId, section, position, JSON.stringify(card)]));
  return Array.from({ length: Math.ceil(rows.length / ROWS_PER_INSERT) }, (_, i) => {
    const chunk = rows.slice(i * ROWS_PER_INSERT, (i + 1) * ROWS_PER_INSERT);
    const placeholders = chunk.map(() => "(?, ?, ?, ?)").join(", ");
    return env.DB.prepare(`INSERT INTO feed_items (user_id, section, position, card) VALUES ${placeholders}`).bind(...chunk.flat());
  });
}

// replaced in one batch, so a reader sees either the old feed or the new one, never half of each
export async function saveFeed(env: Env, userId: string, sections: Record<RankedSection, FeedCard[]>, builtAt: Date) {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM feed_items WHERE user_id = ?").bind(userId),
    ...insertStatements(env, userId, sections),
    env.DB.prepare(
      `INSERT INTO feed_state (user_id, built_at, building_since) VALUES (?1, ?2, NULL)
       ON CONFLICT (user_id) DO UPDATE SET built_at = ?2, building_since = NULL`,
    ).bind(userId, builtAt.toISOString()),
  ]);
}

// the cron rebuilds feeds people already have, oldest first, a bounded number per run
export async function staleFeedOwners(env: Env, now: Date, limit: number) {
  const { results } = await env.DB.prepare("SELECT user_id FROM feed_state WHERE built_at IS NULL OR built_at < ? ORDER BY built_at LIMIT ?")
    .bind(new Date(now.getTime() - STALE_MS).toISOString(), limit)
    .all<{ user_id: string }>();
  return results.map((r) => r.user_id);
}
