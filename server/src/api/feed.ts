import { Hono } from "hono";
import type { AppContext, Env } from "../env";
import { type FeedSources, liveFeedSources, rebuildClaimed } from "../feed/build";
import { claimRebuild, isBuilding, isStale, readFeed } from "../feed/store";
import type { FeedPage } from "../feed/types";

const PAGE_SIZE = 20;

const offsetFrom = (cursor: string | undefined) => (cursor === undefined ? 0 : /^\d{1,6}$/.test(cursor) ? Number(cursor) : null);

// reads only the precomputed table; anything slow (searching, ranking) happens after the response, via waitUntil
export function feedRouter(makeSources: (env: Env) => FeedSources) {
  const router = new Hono<AppContext>();

  router.get("/", async (c) => {
    const offset = offsetFrom(c.req.query("cursor"));
    if (offset === null) return c.json({ error: "cursor must come from a previous page" }, 400);

    const userId = c.var.sessionId;
    const now = new Date();
    const { cards, hasMore, state } = await readFeed(c.env, userId, offset, PAGE_SIZE);

    let building = isBuilding(state, now);
    if (!building && isStale(state, now) && (await claimRebuild(c.env, userId, now))) {
      c.executionCtx.waitUntil(rebuildClaimed(c.env, userId, makeSources(c.env)));
      building = true;
    }

    const page: FeedPage = { items: cards, nextCursor: hasMore ? String(offset + cards.length) : null, building, builtAt: state.builtAt };
    return c.json(page);
  });

  return router;
}

export const feed = feedRouter(liveFeedSources);
