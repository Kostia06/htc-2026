import type { Env } from "../env";
import { ADZUNA_ATTRIBUTION, adzunaSearch, type JobPosting, type JobQuery } from "../integrations/adzuna";
import { sha256 } from "../lib/hash";
import { cached } from "../memory/cache";
import type { Candidate } from "./types";

// a little under the hour after which a feed's jobs count as stale, so that rebuild finds new postings;
// keyed by search, so Adzuna sees at most one call per search per window however many people share it
const SEARCH_CACHE_SECONDS = 45 * 60;
const MAX_POSTING_AGE_MS = 30 * 86_400_000;

export type SearchJobs = (query: JobQuery) => Promise<JobPosting[]>;

// listings are public and keyed by the search alone, so everyone who wants "junior developer" in Calgary shares one call;
// the key is hashed so the cache table never holds the query text itself
export function cachedJobSearch(env: Env): SearchJobs {
  return async (query) => {
    const key = `feed:jobs:${await sha256(`${query.what.toLowerCase()}|${(query.where ?? "").toLowerCase()}`)}`;
    return cached(env, key, SEARCH_CACHE_SECONDS, () => adzunaSearch(env, query));
  };
}

const listingId = (url: string) => url.split("/").pop() ?? url;

export function jobCandidate(posting: JobPosting): Candidate {
  const summary = posting.description.replace(/\s+/g, " ").trim();
  return {
    card: {
      id: `job:${listingId(posting.url)}`,
      kind: "job",
      title: posting.title,
      org: posting.company,
      // for a job "when" is the posting date; the app labels it "Posted"
      ...(posting.posted_at && { when: posting.posted_at }),
      ...(posting.location && { where: posting.location }),
      ...(summary && { summary }),
      ...(posting.salary?.label && { salary: posting.salary.label }),
      url: posting.url,
      source: "Adzuna",
      attribution: { label: ADZUNA_ATTRIBUTION.attribution, url: ADZUNA_ATTRIBUTION.attribution_url },
      // dismissing one of a company's postings steers the ranking away from the rest of them
      tags: [posting.company.toLowerCase()],
    },
    text: `${posting.title}\n${posting.description}`,
    postedAt: posting.posted_at || undefined,
  };
}

// one failed search shouldn't empty the feed; only when every search fails is the old feed kept instead
export async function jobCandidates(search: SearchJobs, queries: JobQuery[], now = new Date()): Promise<Candidate[]> {
  const settled = await Promise.allSettled(queries.map(search));
  if (queries.length > 0 && settled.every((s) => s.status === "rejected")) throw new Error("every job search failed");
  const perQuery = settled.map((s) => (s.status === "fulfilled" ? s.value : []));
  return interleave(perQuery).filter((p) => !isOld(p, now)).map(jobCandidate);
}

// a cached search can outlive a posting's freshness; one without a date is kept, since the date is all we'd judge by
function isOld(posting: JobPosting, now: Date) {
  const posted = Date.parse(posting.posted_at);
  return !Number.isNaN(posted) && now.getTime() - posted > MAX_POSTING_AGE_MS;
}

// the ranker's sort is stable, so equally good jobs for different roles alternate instead of one role filling page one
function interleave<T>(lists: T[][]): T[] {
  const longest = Math.max(0, ...lists.map((l) => l.length));
  return Array.from({ length: longest }, (_, i) => lists.flatMap((l) => (i < l.length ? [l[i]] : []))).flat();
}
