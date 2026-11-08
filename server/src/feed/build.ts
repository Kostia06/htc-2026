import type { Env } from "../env";
import { getProfile } from "../memory/profile/store";
import { criteriaFrom, jobQueries } from "./criteria";
import { cachedJobSearch, jobCandidates, type SearchJobs } from "./jobs";
import { rankCandidates } from "./rank";
import { claimRebuild, releaseClaim, saveFeed, staleFeedOwners } from "./store";

const MAX_CARDS = 60;
const CRON_BATCH = 50;

export type FeedSources = { searchJobs: SearchJobs };

export const liveFeedSources = (env: Env): FeedSources => ({ searchJobs: cachedJobSearch(env) });

// Devpost hackathons are left out on purpose: its terms forbid automated access to the site "or any related data",
// and its /api/hackathons listing is undocumented, so it isn't a public API we may call
export async function buildFeed(env: Env, userId: string, sources: FeedSources, now = new Date()) {
  const criteria = criteriaFrom(await getProfile(env, userId));
  const candidates = await jobCandidates(sources.searchJobs, jobQueries(criteria));
  const cards = rankCandidates(candidates, criteria, now).slice(0, MAX_CARDS);
  await saveFeed(env, userId, cards, now);
  return cards.length;
}

// for waitUntil: never throws, and frees the claim on failure so the next request can retry
export async function rebuildClaimed(env: Env, userId: string, sources: FeedSources) {
  try {
    await buildFeed(env, userId, sources);
  } catch (error) {
    console.error("feed rebuild failed", error instanceof Error ? error.message : String(error));
    await releaseClaim(env, userId);
  }
}

export async function rebuildStaleFeeds(env: Env, sources = liveFeedSources(env), now = new Date()) {
  for (const userId of await staleFeedOwners(env, now, CRON_BATCH)) {
    if (await claimRebuild(env, userId, now)) await rebuildClaimed(env, userId, sources);
  }
}
