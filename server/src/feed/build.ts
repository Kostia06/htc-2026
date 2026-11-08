import type { Env } from "../env";
import { getProfile } from "../memory/profile/store";
import { actionHistory } from "./actions";
import { criteriaFrom, jobQueries } from "./criteria";
import { curatedCandidates } from "./curation";
import { cachedEnrichments, enrichCuratedItems, liveEnrichDeps } from "./enrich";
import { cachedJobSearch, jobCandidates, type SearchJobs } from "./jobs";
import { rankCandidates } from "./rank";
import { sectionsFrom } from "./sections";
import { claimRebuild, releaseClaim, saveFeed, staleFeedOwners } from "./store";

const CRON_BATCH = 50;

// enrichCurated reads a few curated pages that have no cached summary yet and says how many it learned about
export type FeedSources = { searchJobs: SearchJobs; enrichCurated?: () => Promise<number> };

export const liveFeedSources = (env: Env): FeedSources => ({
  searchJobs: cachedJobSearch(env),
  enrichCurated: () => enrichCuratedItems(env, liveEnrichDeps(env)),
});

// jobs come from Adzuna; events, hackathons and courses from the curated list, since Devpost's terms forbid automated
// access and Eventbrite's and Meetup's APIs are closed to new apps. What the person dismissed is left out and steers the rest
export async function buildFeed(env: Env, userId: string, sources: FeedSources, now = new Date()) {
  const [profile, history, enrichments] = await Promise.all([getProfile(env, userId), actionHistory(env, userId), cachedEnrichments(env, now)]);
  const criteria = criteriaFrom(profile, history.avoidTags);
  const jobs = await jobCandidates(sources.searchJobs, jobQueries(criteria), now);
  const candidates = [...jobs, ...curatedCandidates(now, enrichments)].filter((c) => !history.dismissed.has(c.card.id));
  const sections = sectionsFrom(rankCandidates(candidates, criteria, now));
  await saveFeed(env, userId, sections, now);
  return sections.all.length;
}

// the feed is saved first so the person waits for nothing slow; then a few curated pages are read, and when
// that taught us something the feed is saved again with it. Never throws: enrichment is a bonus, not a dependency
async function enrichThenRefresh(env: Env, userId: string, sources: FeedSources) {
  if (!sources.enrichCurated) return;
  try {
    if ((await sources.enrichCurated()) > 0) await buildFeed(env, userId, sources);
  } catch (error) {
    console.warn("feed enrichment failed", error instanceof Error ? error.message : String(error));
  }
}

// for waitUntil: never throws, and frees the claim on failure so the next request can retry
export async function rebuildClaimed(env: Env, userId: string, sources: FeedSources) {
  try {
    await buildFeed(env, userId, sources);
  } catch (error) {
    console.error("feed rebuild failed", error instanceof Error ? error.message : String(error));
    await releaseClaim(env, userId);
    return;
  }
  await enrichThenRefresh(env, userId, sources);
}

export async function rebuildStaleFeeds(env: Env, sources = liveFeedSources(env), now = new Date()) {
  for (const userId of await staleFeedOwners(env, now, CRON_BATCH)) {
    if (await claimRebuild(env, userId, now)) await rebuildClaimed(env, userId, sources);
  }
}
