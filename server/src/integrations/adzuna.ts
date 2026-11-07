import type { Env } from "../env";

const API = "https://api.adzuna.com/v1/api/jobs/ca/search";

export const MAX_PAGE = 100;
export const MAX_PER_PAGE = 50;

export type AdzunaSearchOptions = {
  query: string;
  location?: string;
  page?: number;
  resultsPerPage?: number;
};

// the shape the rest of the app sees; Adzuna's raw fields stay in this file
export type AdzunaJob = {
  id: string;
  title: string;
  description: string;
  company: string | null;
  location: string | null;
  createdAt: string | null;
  redirectUrl: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryIsPredicted: boolean | null;
  contractTime: string | null;
  contractType: string | null;
  category: string | null;
  categoryTag: string | null;
};

export type AdzunaSearchResult = { count: number; jobs: AdzunaJob[] };

type RawJob = {
  id?: string | number;
  title?: string;
  description?: string;
  redirect_url?: string;
  created?: string;
  company?: { display_name?: string };
  location?: { display_name?: string; area?: string[] };
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: number | string;
  contract_time?: string;
  contract_type?: string;
  category?: { label?: string; tag?: string };
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

function normalize(raw: RawJob): AdzunaJob | null {
  if (raw.id === undefined || raw.id === null) return null;
  // Adzuna sends this as 0/1, sometimes as a string
  const predicted = raw.salary_is_predicted === undefined ? null : String(raw.salary_is_predicted) === "1";
  return {
    id: String(raw.id),
    title: str(raw.title) ?? "Untitled position",
    description: str(raw.description) ?? "",
    company: str(raw.company?.display_name),
    location: str(raw.location?.display_name) ?? (raw.location?.area?.length ? raw.location.area.join(", ") : null),
    createdAt: str(raw.created),
    redirectUrl: str(raw.redirect_url),
    salaryMin: num(raw.salary_min),
    salaryMax: num(raw.salary_max),
    salaryIsPredicted: predicted,
    contractTime: str(raw.contract_time),
    contractType: str(raw.contract_type),
    category: str(raw.category?.label),
    categoryTag: str(raw.category?.tag),
  };
}

// Canadian job search. Input is assumed validated by the caller (see api/jobs.ts).
export async function searchAdzunaJobs(env: Env, options: AdzunaSearchOptions): Promise<AdzunaSearchResult> {
  const { query, location = "Calgary", page = 1, resultsPerPage = 20 } = options;
  if (!env.ADZUNA_APP_ID || !env.ADZUNA_APP_KEY) throw new Error("adzuna credentials are not configured");

  const url = new URL(`${API}/${page}`);
  url.searchParams.set("app_id", env.ADZUNA_APP_ID);
  url.searchParams.set("app_key", env.ADZUNA_APP_KEY);
  url.searchParams.set("what", query.trim());
  if (location.trim()) url.searchParams.set("where", location.trim());
  url.searchParams.set("results_per_page", String(resultsPerPage));
  url.searchParams.set("content-type", "application/json");

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  // status only: the URL carries the app key, so it never goes into an error
  if (!res.ok) throw new Error(`adzuna ${res.status}`);

  const json = await res.json<{ count?: number; results?: RawJob[] }>();
  const jobs = (Array.isArray(json.results) ? json.results : []).map(normalize).filter((j): j is AdzunaJob => j !== null);
  return { count: num(json.count) ?? jobs.length, jobs };
}
