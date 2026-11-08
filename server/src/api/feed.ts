import { Hono } from "hono";
import type { AppContext, Env } from "../env";
import { applyAction, findCard, removeSave } from "../feed/actions";
import { type FeedSources, liveFeedSources, rebuildClaimed } from "../feed/build";
import { canPullRebuild, claimRebuild, isBuilding, isStale, readFeed } from "../feed/store";
import { FEED_ACTIONS, FEED_SECTIONS, type FeedAction, type FeedPage, type FeedSection } from "../feed/types";

const PAGE_SIZE = 20;

const offsetFrom = (cursor: string | undefined) => (cursor === undefined ? 0 : /^\d{1,6}$/.test(cursor) ? Number(cursor) : null);
const sectionFrom = (raw: string | undefined): FeedSection | null => (raw === undefined ? "all" : (FEED_SECTIONS.find((s) => s === raw) ?? null));
const actionFrom = (body: unknown): FeedAction | null => {
  const raw = typeof body === "object" && body !== null ? (body as { action?: unknown }).action : undefined;
  return FEED_ACTIONS.find((a) => a === raw) ?? null;
};

// reads only the precomputed tables; anything slow (searching, ranking) happens after the response, via waitUntil
export function feedRouter(makeSources: (env: Env) => FeedSources) {
  const router = new Hono<AppContext>();

  router.get("/", async (c) => {
    const offset = offsetFrom(c.req.query("cursor"));
    if (offset === null) return c.json({ error: "cursor must come from a previous page" }, 400);
    const section = sectionFrom(c.req.query("section"));
    if (section === null) return c.json({ error: `section must be one of ${FEED_SECTIONS.join(", ")}` }, 400);

    const userId = c.var.sessionId;
    const now = new Date();
    const { cards, hasMore, state } = await readFeed(c.env, userId, section, offset, PAGE_SIZE);

    // pull to refresh sends refresh=1 so new postings are searched for now rather than at the next stale check
    const wantsRebuild = isStale(state, now) || (c.req.query("refresh") === "1" && canPullRebuild(state, now));
    let building = isBuilding(state, now);
    if (!building && wantsRebuild && (await claimRebuild(c.env, userId, now))) {
      c.executionCtx.waitUntil(rebuildClaimed(c.env, userId, makeSources(c.env)));
      building = true;
    }

    const page: FeedPage = { items: cards, nextCursor: hasMore ? String(offset + cards.length) : null, building, builtAt: state.builtAt, section };
    return c.json(page);
  });

  router.post("/items/:id", async (c) => {
    const action = actionFrom(await c.req.json().catch(() => null));
    if (action === null) return c.json({ error: `action must be one of ${FEED_ACTIONS.join(", ")}` }, 400);

    const id = c.req.param("id");
    // needs no card: there is nothing to look up for a save that is already gone
    if (action === "unsave") {
      await removeSave(c.env, c.var.sessionId, id);
      return c.json({ id, action });
    }
    const card = await findCard(c.env, c.var.sessionId, id);
    if (!card) return c.json({ error: "that card isn't in your feed" }, 404);

    await applyAction(c.env, c.var.sessionId, card, action, new Date());
    return c.json({ id, action });
  });

  return router;
}

export const feed = feedRouter(liveFeedSources);
