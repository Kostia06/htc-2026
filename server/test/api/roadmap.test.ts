import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { AgentDeps } from "../../src/agents/core/types";
import { roadmapRouter } from "../../src/api/roadmap";
import type { AppContext } from "../../src/env";
import { updateProfile } from "../../src/memory/profile/store";
import { FIRST_BATCH, PAGE_STEPS } from "../../src/roadmap/roadmap";
import type { RoadmapPage, Step } from "../../src/roadmap/types";
import { call, fakeDeps } from "../agents/fakes";

const agentSteps = (count: number) =>
  call("finish", {
    steps: Array.from({ length: count }, (_, i) => ({
      kind: i === 0 ? "interview_practice" : "project",
      title: `Personal step ${i}`,
      why: "You wrote SQL reports at ATB.",
      detail: "Use the lending data you already know.",
      estimate: "2 hours",
      needs: i === 0 ? [{ need: "SQL", evidence: "Wrote SQL reports" }] : [{ need: "Tableau" }],
    })),
  });

function testApp(deps: AgentDeps, refineDeadlineMs = 5_000) {
  const pending: Promise<unknown>[] = [];
  const executionCtx = { waitUntil: (p: Promise<unknown>) => pending.push(p), passThroughOnException: () => {}, props: {} } as unknown as ExecutionContext;
  const app = new Hono<AppContext>()
    .use(async (c, next) => {
      c.set("sessionId", c.req.header("x-test-user") ?? "nobody");
      await next();
    })
    .route("/", roadmapRouter(() => deps, refineDeadlineMs));

  const get = async (user: string, query = "") => {
    const res = await app.request(`/${query}`, { headers: { "x-test-user": user } }, env, executionCtx);
    return { status: res.status, page: (await res.json()) as RoadmapPage };
  };
  const post = async (user: string, id: string, body: unknown) => {
    const res = await app.request(
      `/steps/${id}`,
      { method: "POST", headers: { "x-test-user": user, "Content-Type": "application/json" }, body: JSON.stringify(body) },
      env,
      executionCtx,
    );
    return { status: res.status, step: (await res.json()) as Step };
  };
  const settle = async () => {
    await Promise.all(pending.splice(0));
  };
  return { get, post, settle };
}

async function newUser(goal = "Junior data analyst") {
  const id = `u_${crypto.randomUUID()}`;
  await updateProfile(env, id, { targetRoles: [goal], skills: [{ name: "SQL", source: "resume", evidence: "Wrote SQL reports for the lending team" }] });
  return id;
}

describe("GET /api/roadmap", () => {
  it("answers at once from personalised templates, then the agent refines the same steps in the background", async () => {
    const user = await newUser();
    const { deps } = fakeDeps({ replies: [agentSteps(FIRST_BATCH)] });
    const { get, settle } = testApp(deps);

    const started = Date.now();
    const { status, page } = await get(user);
    expect(Date.now() - started).toBeLessThan(300);
    expect(status).toBe(200);
    expect(page.goal).toBe("Junior data analyst");
    // the template batch plus the one Crossroads step every road gets, at the top
    expect(page.progress).toEqual({ done: 0, total: FIRST_BATCH + 1, streakDays: 0 });
    expect(page.completed).toEqual([]);
    expect(page.next).toHaveLength(PAGE_STEPS);
    expect(page.nextCursor).toBe(String(PAGE_STEPS));
    expect(page.next.every((s) => s.source === "template" && s.status === "todo")).toBe(true);
    expect(page.next[0]).toMatchObject({ kind: "explore_memory", action: { type: "crossroads" } });
    expect(page.next[1].title).toContain("SQL");

    await settle();
    const refined = await get(user);
    expect(refined.page.next.map((s) => s.id)).toEqual(page.next.map((s) => s.id));
    expect(refined.page.next[0]).toEqual(page.next[0]);
    expect(refined.page.next[1]).toMatchObject({ source: "agent", title: "Personal step 0", kind: "interview_practice", label: "ready_now" });
    expect(refined.page.next[1].action).toEqual({ type: "interview", role: "Junior data analyst" });
    expect(refined.page.next[2]).toMatchObject({ source: "agent", label: "stretch" });
    expect(refined.page.next[2].action).toBeUndefined();
  });

  it("stays instant and keeps the templates when the model hangs", async () => {
    const user = await newUser("Registered nurse");
    const hanging: AgentDeps["model"] = () => () => new Promise(() => {});
    const { get, settle } = testApp(fakeDeps({ model: hanging }).deps, 50);
    const first = await get(user);
    await settle();
    const again = await get(user);
    expect(again.page.next.every((s) => s.source === "template")).toBe(true);
    expect(again.page.next.map((s) => s.id)).toEqual(first.page.next.map((s) => s.id));
  });

  it("never rewrites a step the person finished while the agent was thinking", async () => {
    const user = await newUser();
    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const slow: AgentDeps["model"] = () => async () => {
      await gate;
      return agentSteps(FIRST_BATCH);
    };
    const { get, post, settle } = testApp(fakeDeps({ model: slow }).deps);
    const { page } = await get(user);
    await post(user, page.next[0].id, { status: "done" });
    release();
    await settle();

    const after = await get(user);
    const finished = after.page.completed[0].steps[0];
    expect(finished.id).toBe(page.next[0].id);
    expect(finished.title).toBe(page.next[0].title);
    expect(after.page.next[0]).toMatchObject({ id: page.next[1].id, source: "agent" });
  });

  it("pages the upcoming steps and grows the path with templates at the end, keeping what it stored", async () => {
    const user = await newUser();
    const { get, settle } = testApp(fakeDeps({ replies: [] }).deps);
    const first = await get(user);
    await settle();
    const second = await get(user, `?cursor=${first.page.nextCursor}`);
    await settle();

    expect(second.page.next).toHaveLength(PAGE_STEPS);
    expect(second.page.nextCursor).toBe(String(2 * PAGE_STEPS));
    expect(second.page.progress.total).toBe(2 * PAGE_STEPS);
    const ids = (p: RoadmapPage) => p.next.map((s) => s.id);
    expect(new Set([...ids(first.page), ...ids(second.page)]).size).toBe(2 * PAGE_STEPS);
    expect(ids((await get(user)).page)).toEqual(ids(first.page));
  });

  it("rejects a cursor that isn't a number or points past the end, and shrugs off a bad time zone", async () => {
    const user = await newUser();
    const { get } = testApp(fakeDeps().deps);
    expect((await get(user, "?cursor=abc")).status).toBe(400);
    expect((await get(user, "?cursor=50")).status).toBe(400);
    expect((await get(user, "?tz=Mars/Olympus")).status).toBe(200);
  });
});

describe("POST /api/roadmap/steps/:id", () => {
  it("marks a step done with a note and moves it into today's completed group", async () => {
    const user = await newUser();
    const { get, post } = testApp(fakeDeps().deps);
    const step = (await get(user)).page.next[0];

    const { status, step: updated } = await post(user, step.id, { status: "done", note: "Shipped it: github.com/me/dashboard" });
    expect(status).toBe(200);
    expect(updated).toMatchObject({ id: step.id, status: "done", note: "Shipped it: github.com/me/dashboard" });
    expect(updated.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const { page } = await get(user, "?tz=America/Edmonton");
    expect(page.next.map((s) => s.id)).not.toContain(step.id);
    expect(page.progress).toMatchObject({ done: 1, streakDays: 1 });
    expect(page.completed).toHaveLength(1);
    expect(page.completed[0].day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(page.completed[0].steps[0]).toMatchObject({ id: step.id, note: "Shipped it: github.com/me/dashboard" });
  });

  it("shows the resume's finished steps without counting them as today's streak", async () => {
    const user = await newUser();
    await updateProfile(env, user, { projects: [{ name: "Transit delay predictor" }] });
    const { get, post } = testApp(fakeDeps().deps);

    const first = await get(user);
    const resume = first.page.completed.flatMap((d) => d.steps);
    expect(resume.map((s) => [s.title, s.completedVia])).toEqual([["Transit delay predictor", "resume"]]);
    expect(first.page.progress.streakDays).toBe(0);

    await post(user, first.page.next[0].id, { status: "done" });
    const { page } = await get(user);
    expect(page.progress.streakDays).toBe(1);
    expect(page.completed.flatMap((d) => d.steps).find((s) => s.id === first.page.next[0].id)?.completedVia).toBeNull();
  });

  it("takes a step back to todo and clears its completion", async () => {
    const user = await newUser();
    const { get, post } = testApp(fakeDeps().deps);
    const step = (await get(user)).page.next[0];
    await post(user, step.id, { status: "done" });
    const { step: reverted } = await post(user, step.id, { status: "todo" });
    expect(reverted).toMatchObject({ status: "todo", completedAt: null });
    expect((await get(user)).page.progress.done).toBe(0);
  });

  it("rejects an unknown status, an oversized note or an unknown step", async () => {
    const user = await newUser();
    const { get, post } = testApp(fakeDeps().deps);
    const step = (await get(user)).page.next[0];
    expect((await post(user, step.id, { status: "finished" })).status).toBe(400);
    expect((await post(user, step.id, { status: "done", note: "x".repeat(501) })).status).toBe(400);
    expect((await post(user, "st_nope", { status: "done" })).status).toBe(404);
  });

  it("keeps each person's roadmap to themselves", async () => {
    const owner = await newUser();
    const other = await newUser("Graphic designer");
    const { get, post } = testApp(fakeDeps().deps);
    const step = (await get(owner)).page.next[0];

    expect((await post(other, step.id, { status: "done" })).status).toBe(404);
    expect((await get(other)).page.next.map((s) => s.id)).not.toContain(step.id);
    expect((await get(owner)).page.progress.done).toBe(0);
  });
});
