import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";

import app from "../../src/index";
import { deps } from "../../src/api/jobs";
import { issueSession } from "../../src/auth/session";

const result = { count: 1, jobs: [{ id: "1", title: "Data Analyst" }] };

async function get(qs: string, token?: string) {
  const auth = token ?? (await issueSession(env.SESSION_SECRET));
  return app.request(`/api/jobs${qs}`, { headers: { Authorization: `Bearer ${auth}` } }, env);
}

describe("GET /api/jobs", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(deps, "searchAdzunaJobs").mockResolvedValue(result as never);
  });

  it("returns jobs for a query", async () => {
    const res = await get("?q=data%20analyst&page=2&perPage=10");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ...result, page: 2, perPage: 10, cached: false });
    expect(deps.searchAdzunaJobs).toHaveBeenCalledWith(env, { query: "data analyst", location: "Calgary", page: 2, resultsPerPage: 10 });
  });

  it("serves a repeated search from the cache", async () => {
    await get("?q=Data%20Analyst");
    const res = await get("?q=data%20analyst");
    expect(await res.json()).toMatchObject({ cached: true });
    expect(deps.searchAdzunaJobs).toHaveBeenCalledTimes(1);
  });

  it("requires a session", async () => {
    expect((await get("?q=x", "bad")).status).toBe(401);
  });

  it("returns 400 for bad input", async () => {
    expect((await get("")).status).toBe(400);
    expect((await get(`?q=${"a".repeat(101)}`)).status).toBe(400);
    expect((await get("?q=x&page=0")).status).toBe(400);
    expect((await get("?q=x&perPage=51")).status).toBe(400);
    expect((await get("?q=x&page=abc")).status).toBe(400);
  });

  it("returns 502 when Adzuna fails", async () => {
    vi.spyOn(deps, "searchAdzunaJobs").mockRejectedValue(new Error("adzuna 500"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await get("?q=x")).status).toBe(502);
  });
});
