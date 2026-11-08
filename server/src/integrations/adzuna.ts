import type { Env } from "../env";
import { USER_AGENT } from "../lib/user-agent";

const API = "https://api.adzuna.com/v1/api/jobs/ca/search/1";
const RESULTS_PER_PAGE = 10;

// Adzuna's terms require this label, linked to the local site, on every listing we show
export const ADZUNA_ATTRIBUTION = { attribution: "Jobs by Adzuna", attribution_url: "https://www.adzuna.ca" } as const;

export type JobQuery = { what: string; where?: string };

export type JobPosting = {
  title: string;
  company: string;
  location: string;
  posted_at: string;
  // Adzuna cuts it at 500 characters; the full text stays behind the link, which we never fetch
  description: string;
  url: string;
  category?: string;
  contract_time?: string;
  contract_type?: string;
  salary?: { min?: number; max?: number; estimated: boolean; label?: string };
  attribution: string;
  attribution_url: string;
};

type RawPosting = {
  id: string;
  title?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  category?: { label?: string };
  created?: string;
  description?: string;
  contract_time?: string;
  contract_type?: string;
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: string;
};

function salaryOf(raw: RawPosting): JobPosting["salary"] {
  if (raw.salary_min === undefined && raw.salary_max === undefined) return undefined;
  const estimated = raw.salary_is_predicted === "1";
  return { min: raw.salary_min, max: raw.salary_max, estimated, ...(estimated && { label: "Adzuna Jobsworth estimate" }) };
}

// built from the id: the API's redirect_url carries our app id in its query string
function toPosting(raw: RawPosting): JobPosting {
  const salary = salaryOf(raw);
  return {
    title: raw.title ?? "",
    company: raw.company?.display_name ?? "",
    location: raw.location?.display_name ?? "",
    posted_at: raw.created ?? "",
    description: raw.description ?? "",
    url: `https://www.adzuna.ca/details/${encodeURIComponent(raw.id)}`,
    ...(raw.category?.label && { category: raw.category.label }),
    ...(raw.contract_time && { contract_time: raw.contract_time }),
    ...(raw.contract_type && { contract_type: raw.contract_type }),
    ...(salary && { salary }),
    ...ADZUNA_ATTRIBUTION,
  };
}

export async function adzunaSearch(env: Env, query: JobQuery): Promise<JobPosting[]> {
  if (!env.ADZUNA_APP_ID || !env.ADZUNA_APP_KEY) throw new Error("job search is not configured");
  const params = new URLSearchParams({
    app_id: env.ADZUNA_APP_ID,
    app_key: env.ADZUNA_APP_KEY,
    what: query.what,
    results_per_page: String(RESULTS_PER_PAGE),
    "content-type": "application/json",
  });
  if (query.where) params.set("where", query.where);
  const res = await fetch(`${API}?${params}`, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
  if (!res.ok) throw new Error(`Adzuna HTTP ${res.status}`);
  const json = await res.json<{ results?: RawPosting[] }>();
  return (json.results ?? []).filter((r) => r.id).map(toPosting);
}
