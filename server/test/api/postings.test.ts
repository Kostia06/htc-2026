import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { postingsRouter } from "../../src/api/postings";
import { issueSession, requireSession, verifySession } from "../../src/auth/session";
import type { AppContext } from "../../src/env";
import type { GeminiContent } from "../../src/integrations/gemini";
import type { Posting } from "../../src/postings/types";
import { loadAll } from "../../src/roadmap/store";
import { call, fakeDeps, fakeMemory, fakeServices, type FakeMemory } from "../agents/fakes";

type Options = { hourlyLimit?: number; services?: ReturnType<typeof fakeServices> };
type ErrorBody = { error: string; needsText?: boolean; reason?: string };

function postingsApp(replies: GeminiContent[], memory: FakeMemory = fakeMemory(), options: Options = {}) {
  const app = new Hono<AppContext>();
  app.use("*", requireSession);
  const fakes = fakeDeps({ replies, memory, ...(options.services ? { services: options.services } : {}) });
  app.route("/", postingsRouter(() => fakes.deps, options));
  return { app, ...fakes };
}

async function person() {
  const token = await issueSession(env.SESSION_SECRET);
  return { token, id: (await verifySession(token, env.SESSION_SECRET))! };
}

const executionCtx = { waitUntil: () => {}, passThroughOnException: () => {}, props: {} } as unknown as ExecutionContext;
const headers = (token: string) => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });
const post = (app: Hono<AppContext>, token: string, body: unknown) =>
  app.request("/", { method: "POST", headers: headers(token), body: JSON.stringify(body) }, env, executionCtx);
const get = (app: Hono<AppContext>, token: string, path = "/") => app.request(path, { headers: headers(token) }, env, executionCtx);

const POSTING_TEXT = `Junior Data Analyst at Acme Analytics (Calgary, hybrid)
Requirements: SQL, Python, Tableau. Nice to have: dbt.
You will build dashboards and clean data.`;

const extracted = (over: Record<string, unknown> = {}) =>
  call("finish", {
    title: "Junior Data Analyst",
    company: "Acme Analytics",
    location: "Calgary, hybrid",
    seniority: "Junior",
    requirements: [
      { text: "SQL", topic: "SQL", required: true, evidence: "Skill: SQL" },
      { text: "Python", topic: "Python", required: true },
      { text: "Experience with Tableau", topic: "Tableau", required: true, evidence: "Skill: Tableau" },
      { text: "dbt is a plus", topic: "dbt", required: false },
    ],
    responsibilities: ["Build dashboards for the lending team", "Clean and load data"],
    skills: ["SQL", "Python", "Tableau", "dbt"],
    ...over,
  });

async function profiled() {
  const memory = fakeMemory();
  await memory.updateProfile({ skills: [{ name: "SQL", source: "resume" }, { name: "Python", source: "self-reported" }], targetRoles: ["Data analyst"] });
  return memory;
}

describe("POST /api/postings", () => {
  it("reads a pasted posting, marks what the person has, and prefills the role, company and roadmap", async () => {
    const me = await person();
    const memory = await profiled();
    const { app, conversations, deps } = postingsApp([extracted()], memory);

    const res = await post(app, me.token, { text: POSTING_TEXT });
    expect(res.status).toBe(201);
    const posting = await res.json<Posting>();
    expect(posting).toMatchObject({ title: "Junior Data Analyst", company: "Acme Analytics", companySlug: "acme-analytics", location: "Calgary, hybrid", seniority: "Junior", sourceUrl: null });
    // the model's SQL quote is real; its Tableau quote is not; Python is proven by the skill's name alone
    expect(posting.requirements.map((r) => [r.text, r.have])).toEqual([["SQL", true], ["Python", true], ["Experience with Tableau", false], ["dbt is a plus", false]]);
    expect(posting.requirements[1].evidence).toBe("Skill: Python");
    expect(posting.requirements[2].evidence).toBeUndefined();

    expect(posting.prefilled).toEqual({
      targetRole: "Junior Data Analyst",
      company: { slug: "acme-analytics", name: "Acme Analytics", researchQueued: true },
      steps: ["Build up Tableau", "Build up dbt", "Practice the Junior Data Analyst interview"],
    });
    expect((await memory.profile()).targetRoles).toEqual(["Data analyst", "Junior Data Analyst"]);
    expect(deps.services.startResearch).toHaveBeenCalledWith("acme-analytics");
    const company = await env.DB.prepare("SELECT slug, name FROM companies WHERE slug = 'acme-analytics'").first();
    expect(company).toEqual({ slug: "acme-analytics", name: "Acme Analytics" });

    const steps = await loadAll(env, me.id);
    expect(steps.map((s) => [s.kind, s.title, s.label])).toEqual([
      ["course", "Build up Tableau", "stretch"],
      ["course", "Build up dbt", "ready_now"],
      ["interview_practice", "Practice the Junior Data Analyst interview", "ready_now"],
    ]);
    expect(steps[2].action).toEqual({ type: "interview", companySlug: "acme-analytics", role: "Junior Data Analyst", postingId: posting.id });

    const goal = conversations[0][0].parts[0].text!;
    expect(goal).toContain("Skill: SQL");
    expect(goal).toContain("<untrusted-web-content>");
    expect(goal).toContain("Junior Data Analyst at Acme Analytics");
  });

  it("reuses a company Raven already knows instead of making a second one", async () => {
    await env.DB.prepare("INSERT INTO companies (id, slug, name) VALUES ('c1', 'acme-analytics', 'ACME Analytics Ltd')").run();
    const me = await person();
    const { app } = postingsApp([extracted()]);
    const posting = await (await post(app, me.token, { text: POSTING_TEXT })).json<Posting>();
    expect(posting.prefilled.company).toEqual({ slug: "acme-analytics", name: "ACME Analytics Ltd", researchQueued: true });
    expect((await env.DB.prepare("SELECT count(*) AS n FROM companies").first<{ n: number }>())?.n).toBe(1);
  });

  it("fetches a link through the page fetcher and hands the page to the model", async () => {
    const me = await person();
    const services = fakeServices({ fetchPage: vi.fn(async () => "Acme Analytics is hiring a Junior Data Analyst. Requirements: SQL.") });
    const { app, conversations } = postingsApp([extracted()], fakeMemory(), { services });
    const res = await post(app, me.token, { url: "https://acme.com/careers/123" });
    expect(res.status).toBe(201);
    expect((await res.json<Posting>()).sourceUrl).toBe("https://acme.com/careers/123");
    expect(services.fetchPage).toHaveBeenCalledWith("https://acme.com/careers/123");
    expect(conversations[0][0].parts[0].text).toContain("Acme Analytics is hiring");
  });

  it("asks for the text when the site is off limits or its robots.txt says no, without fetching", async () => {
    const me = await person();
    const blocked = postingsApp([extracted()]);
    const res = await post(blocked.app, me.token, { url: "https://www.linkedin.com/jobs/view/123" });
    expect(res.status).toBe(422);
    expect(await res.json<ErrorBody>()).toMatchObject({ needsText: true, reason: expect.stringMatching(/not allowed/) });
    expect(blocked.deps.services.fetchPage).not.toHaveBeenCalled();
    expect(blocked.conversations).toHaveLength(0);

    for (const url of ["https://ca.indeed.com/viewjob?jk=1", "https://www.glassdoor.ca/job-listing/1", "https://www.adzuna.ca/land/ad/1"]) {
      expect((await post(blocked.app, me.token, { url })).status).toBe(422);
    }

    const services = fakeServices({ fetchRobots: vi.fn(async () => "User-agent: *\nDisallow: /careers") });
    const refused = postingsApp([extracted()], fakeMemory(), { services });
    expect((await post(refused.app, me.token, { url: "https://acme.com/careers/123" })).status).toBe(422);
    expect(services.fetchPage).not.toHaveBeenCalled();
  });

  it("lists and reads postings for their owner only", async () => {
    const me = await person();
    const { app } = postingsApp([extracted(), extracted({ title: "Data Engineer" })]);
    const first = await (await post(app, me.token, { text: POSTING_TEXT })).json<Posting>();
    const second = await (await post(app, me.token, { text: POSTING_TEXT })).json<Posting>();

    const list = await (await get(app, me.token)).json<{ postings: Posting[] }>();
    expect(list.postings.map((p) => p.id)).toEqual([second.id, first.id]);
    expect((await (await get(app, me.token, `/${first.id}`)).json<Posting>()).title).toBe("Junior Data Analyst");

    const stranger = await person();
    expect((await get(app, stranger.token, `/${first.id}`)).status).toBe(404);
    expect((await (await get(app, stranger.token)).json<{ postings: Posting[] }>()).postings).toEqual([]);
  });

  it("rejects bad input, a model that finds no posting, and too many imports", async () => {
    const me = await person();
    const { app } = postingsApp([call("finish", { title: "", company: "", requirements: [], responsibilities: [], skills: [] })]);
    expect((await post(app, me.token, {})).status).toBe(400);
    expect((await post(app, me.token, { text: "   " })).status).toBe(400);
    expect((await post(app, me.token, { url: "ftp://acme.com/x" })).status).toBe(400);
    expect((await post(app, me.token, { text: POSTING_TEXT })).status).toBe(502);

    // a fresh person: the failed run above already counts against the limit, as any recorded run does
    const other = await person();
    const limited = postingsApp([extracted(), extracted()], fakeMemory(), { hourlyLimit: 1 });
    expect((await post(limited.app, other.token, { text: POSTING_TEXT })).status).toBe(201);
    expect((await post(limited.app, other.token, { text: POSTING_TEXT })).status).toBe(429);
  });
});
