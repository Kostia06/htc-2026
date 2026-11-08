import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { AgentDeps } from "../../src/agents/core/types";
import { roadmapRouter } from "../../src/api/roadmap";
import type { AppContext } from "../../src/env";
import { updateProfile } from "../../src/memory/profile/store";
import type { RoadmapPage } from "../../src/roadmap/types";
import { call, fakeDeps, fakeServices } from "../agents/fakes";

const agentUnit = (title: string) =>
  call("finish", {
    title,
    summary: "Start with SQL you already know.",
    steps: [
      { kind: "project", title: "Build a SQL dashboard", why: "You wrote SQL reports at ATB.", estimate: "2 weekends", needs: [{ need: "SQL", evidence: "Wrote SQL reports" }] },
      { kind: "course", title: "Learn Tableau basics", why: "Analyst postings ask for it.", estimate: "3 weeks", needs: [{ need: "Tableau" }] },
      { kind: "networking", title: "Meet an analyst", why: "Hear what the job is like.", estimate: "1 hour", needs: [{ need: "Python" }, { need: "Statistics", evidence: "a stats degree" }] },
    ],
  });

const FAST = { deadlineMs: 200, backgroundDeadlineMs: 200 };

function testApp(deps: AgentDeps, deadlines = FAST) {
  const pending: Promise<unknown>[] = [];
  const executionCtx = { waitUntil: (p: Promise<unknown>) => pending.push(p), passThroughOnException: () => {}, props: {} } as unknown as ExecutionContext;
  const app = new Hono<AppContext>()
    .use(async (c, next) => {
      c.set("sessionId", c.req.header("x-test-user") ?? "nobody");
      await next();
    })
    .route("/", roadmapRouter(() => deps, deadlines));

  const get = async (user: string, cursor?: string) => {
    const res = await app.request(cursor === undefined ? "/" : `/?cursor=${cursor}`, { headers: { "x-test-user": user } }, env, executionCtx);
    return { status: res.status, page: (await res.json()) as RoadmapPage };
  };
  const setStatus = (user: string, id: string, status: unknown) =>
    app.request(`/steps/${id}`, { method: "POST", headers: { "x-test-user": user, "Content-Type": "application/json" }, body: JSON.stringify({ status }) }, env, executionCtx);
  const settle = async () => {
    await Promise.all(pending.splice(0));
  };
  return { get, setStatus, settle };
}

async function newUser(goal = "Junior data analyst") {
  const id = `u_${crypto.randomUUID()}`;
  await updateProfile(env, id, { targetRoles: [goal], skills: [{ name: "SQL", source: "resume", evidence: "Wrote SQL reports for the lending team" }] });
  return id;
}

describe("GET /api/roadmap", () => {
  it("plans the first unit with the agent, labels steps in code and pre-generates the next unit", async () => {
    const user = await newUser();
    const { deps, toolNames } = fakeDeps({ replies: [agentUnit("Analyst basics"), agentUnit("Show your work")] });
    const { get, settle } = testApp(deps, { deadlineMs: 5_000, backgroundDeadlineMs: 5_000 });

    const { status, page } = await get(user);
    expect(status).toBe(200);
    expect(page.goal).toBe("Junior data analyst");
    expect(page.units).toHaveLength(1);
    expect(page.units[0]).toMatchObject({ index: 0, title: "Analyst basics", source: "agent" });
    expect(page.units[0].steps.map((s) => [s.label, s.status])).toEqual([
      ["ready_now", "todo"],
      ["stretch", "todo"],
      ["long_term", "todo"],
    ]);
    expect(page.summary).toEqual({ done: 0, total: 3, thisWeek: 0 });
    expect(page.nextCursor).toBe("1");
    expect(toolNames[0]).toEqual(["finish"]);

    await settle();
    const next = await get(user, "1");
    expect(next.page.units[0]).toMatchObject({ index: 1, title: "Show your work", source: "agent" });
    expect(next.page.summary.total).toBe(6);
  });

  it("falls back to the field's template when the model fails, so the path is never empty", async () => {
    const user = await newUser("Registered nurse");
    const { get } = testApp(fakeDeps({ replies: [] }).deps);
    const { page } = await get(user);
    expect(page.units[0].source).toBe("template");
    expect(page.units[0].steps.length).toBeGreaterThanOrEqual(3);
    expect(page.units[0].steps.some((s) => s.why.includes("Registered nurse"))).toBe(true);
  });

  it("falls back to the template when the model is too slow", async () => {
    const user = await newUser();
    const hanging: AgentDeps["model"] = () => () => new Promise(() => {});
    const { get } = testApp(fakeDeps({ model: hanging }).deps, { deadlineMs: 50, backgroundDeadlineMs: 50 });
    const started = Date.now();
    const { page } = await get(user);
    expect(page.units[0].source).toBe("template");
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("uses the template when another request is already generating and nothing arrives in time", async () => {
    const user = await newUser();
    const services = fakeServices({ claimCooldown: async () => false });
    const { get } = testApp(fakeDeps({ services, replies: [agentUnit("Never used")] }).deps, { deadlineMs: 50, backgroundDeadlineMs: 50 });
    expect((await get(user)).page.units[0].source).toBe("template");
  });

  it("pages through stored units, generates past the last one and keeps what it stored", async () => {
    const user = await newUser();
    const { get, settle } = testApp(fakeDeps({ replies: [] }).deps);
    const first = await get(user);
    await settle();
    const second = await get(user, first.page.nextCursor!);
    await settle();
    const third = await get(user, second.page.nextCursor!);
    await settle();

    expect([first, second, third].map((r) => r.page.units.map((u) => u.index))).toEqual([[0], [1], [2]]);
    const again = await get(user);
    const firstStepIds = (pages: RoadmapPage[]) => pages.flatMap((p) => p.units.map((u) => u.steps[0].id));
    expect(firstStepIds([again.page])).toEqual(firstStepIds([first.page, second.page]));
    expect(again.page.nextCursor).toBe("2");
  });

  it("rejects a cursor that isn't a number or points past the end", async () => {
    const user = await newUser();
    const { get } = testApp(fakeDeps().deps);
    expect((await get(user, "abc")).status).toBe(400);
    expect((await get(user, "5")).status).toBe(400);
  });
});

describe("POST /api/roadmap/steps/:id", () => {
  it("records a status and counts it in the summary", async () => {
    const user = await newUser();
    const { get, setStatus } = testApp(fakeDeps().deps);
    const step = (await get(user)).page.units[0].steps[0];

    const res = await setStatus(user, step.id, "done");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: step.id, status: "done" });
    const { page } = await get(user);
    expect(page.units[0].steps[0].status).toBe("done");
    expect(page.summary).toMatchObject({ done: 1, thisWeek: 1 });
  });

  it("rejects an unknown status or step", async () => {
    const user = await newUser();
    const { get, setStatus } = testApp(fakeDeps().deps);
    const step = (await get(user)).page.units[0].steps[0];
    expect((await setStatus(user, step.id, "finished")).status).toBe(400);
    expect((await setStatus(user, "st_nope", "done")).status).toBe(404);
  });

  it("keeps each person's roadmap to themselves", async () => {
    const owner = await newUser();
    const other = await newUser("Graphic designer");
    const { get, setStatus } = testApp(fakeDeps().deps);
    const step = (await get(owner)).page.units[0].steps[0];

    expect((await setStatus(other, step.id, "done")).status).toBe(404);
    const theirs = await get(other);
    expect(theirs.page.units[0].steps.map((s) => s.id)).not.toContain(step.id);
    expect((await get(owner)).page.summary.done).toBe(0);
  });
});
