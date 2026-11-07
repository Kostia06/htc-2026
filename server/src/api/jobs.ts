import { Hono } from "hono";
import type { AppContext } from "../env";
import { MAX_PAGE, MAX_PER_PAGE, searchAdzunaJobs } from "../integrations/adzuna";

const MAX_QUERY_LEN = 100;
const CACHE_TTL_MS = 60 * 60 * 1000; // Adzuna's free tier is rate limited, so identical searches reuse results for an hour

// swapped out in tests: Adzuna only exists remotely
export const deps = { searchAdzunaJobs };

export const jobs = new Hono<AppContext>();

// GET /api/jobs?q=data analyst&location=Calgary&page=1&perPage=20
jobs.get("/", async (c) => {
  const query = (c.req.query("q") ?? "").trim();
  const location = (c.req.query("location") ?? "Calgary").trim();
  const page = Number(c.req.query("page") ?? 1);
  const perPage = Number(c.req.query("perPage") ?? 20);

  if (!query || query.length > MAX_QUERY_LEN || location.length > MAX_QUERY_LEN) {
    return c.json({ error: `q is required; q and location must be under ${MAX_QUERY_LEN} characters` }, 400);
  }
  if (!Number.isInteger(page) || page < 1 || page > MAX_PAGE) return c.json({ error: `page must be 1-${MAX_PAGE}` }, 400);
  if (!Number.isInteger(perPage) || perPage < 1 || perPage > MAX_PER_PAGE) {
    return c.json({ error: `perPage must be 1-${MAX_PER_PAGE}` }, 400);
  }

  const key = `adzuna:${query.toLowerCase()}|${location.toLowerCase()}|${page}|${perPage}`;
  const now = new Date();
  const cached = await c.env.DB.prepare("SELECT value FROM cache WHERE key = ? AND expires_at > ?")
    .bind(key, now.toISOString())
    .first<{ value: string }>();
  if (cached) return c.json({ ...JSON.parse(cached.value), page, perPage, cached: true });

  let result;
  try {
    result = await deps.searchAdzunaJobs(c.env, { query, location, page, resultsPerPage: perPage });
  } catch (err) {
    console.error("job search failed", err);
    return c.json({ error: "job search is unavailable right now, try again later" }, 502);
  }

  const expires = new Date(now.getTime() + CACHE_TTL_MS).toISOString();
  await c.env.DB.prepare("INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)")
    .bind(key, JSON.stringify(result), expires)
    .run();

  return c.json({ ...result, page, perPage, cached: false });
});
