import type { Env } from "../env";
import { getProfile } from "../memory/profile/store";
import { actionHistory } from "./actions";
import { criteriaFrom, jobQueries } from "./criteria";
import { curatedCandidates } from "./curation";
import { cachedJobSearch, jobCandidates, type SearchJobs } from "./jobs";
import { rankCandidates } from "./rank";
import { sectionsFrom } from "./sections";
import { claimRebuild, releaseClaim, saveFeed, staleFeedOwners } from "./store";

const CRON_BATCH = 50;

export type FeedSources = { searchJobs: SearchJobs };

export const liveFeedSources = (env: Env): FeedSources => ({ searchJobs: cachedJobSearch(env) });

// jobs come from Adzuna; events, hackathons and courses from the curated list, since Devpost's terms forbid automated
// access and Eventbrite's and Meetup's APIs are closed to new apps. What the person dismissed is left out and steers the rest
export async function buildFeed(env: Env, userId: string, sources: FeedSources, now = new Date()) {
  const [profile, history] = await Promise.all([getProfile(env, userId), actionHistory(env, userId)]);
  const criteria = criteriaFrom(profile, history.avoidTags);
  const jobs = await jobCandidates(sources.searchJobs, jobQueries(criteria));
  const candidates = [...jobs, ...curatedCandidates(now)].filter((c) => !history.dismissed.has(c.card.id));
  const sections = sectionsFrom(rankCandidates(candidates, criteria, now));
  await saveFeed(env, userId, sections, now);
  return sections.all.length;
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
