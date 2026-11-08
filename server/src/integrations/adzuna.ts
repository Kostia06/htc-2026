import type { Env } from "../env";
import { USER_AGENT } from "../lib/user-agent";

const API_BASE = "https://api.adzuna.com/v1/api/jobs/ca/search";
const DEFAULT_RESULTS_PER_PAGE = 10;
const MAX_RESULTS_PER_PAGE = 50;

// Adzuna's terms require this attribution wherever listings are displayed.
export const ADZUNA_ATTRIBUTION = {
  attribution: "Jobs by Adzuna",
  attribution_url: "https://www.adzuna.ca",
} as const;

export type JobQuery = { what: string; where?: string };

export type JobPosting = {
  title: string;
  company: string;
  location: string;
  posted_at: string;
  // Adzuna descriptions may be short previews rather than full job descriptions.
  description: string;
  url: string;
  category?: string;
  contract_time?: string;
  contract_type?: string;
  salary?: { min?: number; max?: number; estimated: boolean; label?: string };
  attribution: string;
  attribution_url: string;
};

// The job analyzer also needs the stable Adzuna ID and the posting URL.
export type AdzunaAnalysisJob = JobPosting & {
  id: string;
  redirectUrl: string;
};

export type AdzunaSearchOptions = {
  query: string;
  location?: string;
  page?: number;
  resultsPerPage?: number;
};

export type AdzunaSearchResult = {
  count: number;
  jobs: AdzunaAnalysisJob[];
};

type RawPosting = {
  id: string | number;
  title?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  category?: { label?: string };
  created?: string;
  description?: string;
  redirect_url?: string;
  contract_time?: string;
  contract_type?: string;
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: string;
};

type RawSearchResponse = {
  count?: number;
  results?: RawPosting[];
};

function salaryOf(raw: RawPosting): JobPosting["salary"] {
  if (raw.salary_min === undefined && raw.salary_max === undefined) return undefined;
  const estimated = raw.salary_is_predicted === "1";
  return {
    min: raw.salary_min,
    max: raw.salary_max,
    estimated,
    ...(estimated ? { label: "Adzuna Jobsworth estimate" } : {}),
  };
}

function toPosting(raw: RawPosting): AdzunaAnalysisJob {
  const id = String(raw.id);
  const redirectUrl =
      raw.redirect_url || `https://www.adzuna.ca/details/${encodeURIComponent(id)}`;
  const salary = salaryOf(raw);

  return {
    id,
    title: raw.title ?? "",
    company: raw.company?.display_name ?? "",
    location: raw.location?.display_name ?? "",
    posted_at: raw.created ?? "",
    description: raw.description ?? "",
    url: redirectUrl,
    redirectUrl,
    ...(raw.category?.label ? { category: raw.category.label } : {}),
    ...(raw.contract_time ? { contract_time: raw.contract_time } : {}),
    ...(raw.contract_type ? { contract_type: raw.contract_type } : {}),
    ...(salary ? { salary } : {}),
    ...ADZUNA_ATTRIBUTION,
  };
}

/**
 * Search Adzuna with pagination. This is the structured response expected by
 * job-analyzer.ts: { count, jobs }, where every job has id and redirectUrl.
 */
export async function searchAdzunaJobs(
    env: Env,
    options: AdzunaSearchOptions,
): Promise<AdzunaSearchResult> {
  if (!env.ADZUNA_APP_ID || !env.ADZUNA_APP_KEY) {
    throw new Error("job search is not configured");
  }

  const query = options.query.trim();
  const location = options.location?.trim();
  const page = options.page ?? 1;
  const resultsPerPage = options.resultsPerPage ?? DEFAULT_RESULTS_PER_PAGE;

  if (!query) throw new Error("Adzuna search query cannot be empty.");
  if (!Number.isInteger(page) || page < 1 || page > 50) {
    throw new Error("Adzuna page must be an integer between 1 and 50.");
  }
  if (
      !Number.isInteger(resultsPerPage) ||
      resultsPerPage < 1 ||
      resultsPerPage > MAX_RESULTS_PER_PAGE
  ) {
    throw new Error(`Adzuna resultsPerPage must be between 1 and ${MAX_RESULTS_PER_PAGE}.`);
  }

  const params = new URLSearchParams({
    app_id: env.ADZUNA_APP_ID,
    app_key: env.ADZUNA_APP_KEY,
    what: query,
    results_per_page: String(resultsPerPage),
    "content-type": "application/json",
  });
  if (location) params.set("where", location);

  const response = await fetch(`${API_BASE}/${page}?${params.toString()}`, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Adzuna HTTP ${response.status}`);
  }

  const json = await response.json<RawSearchResponse>();
  const jobs = (json.results ?? [])
      .filter((posting) => posting.id !== undefined && posting.id !== null)
      .map(toPosting);

  return {
    count: Number.isFinite(json.count) ? Number(json.count) : jobs.length,
    jobs,
  };
}

/**
 * Backwards-compatible helper used by the existing agent services.
 * Keep its old signature and array return type so other backend features
 * that already call adzunaSearch do not need to change.
 */
export async function adzunaSearch(
    env: Env,
    query: JobQuery,
): Promise<JobPosting[]> {
  const result = await searchAdzunaJobs(env, {
    query: query.what,
    location: query.where,
    page: 1,
    resultsPerPage: DEFAULT_RESULTS_PER_PAGE,
  });
  return result.jobs;
}
