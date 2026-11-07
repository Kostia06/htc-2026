import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import type { AgentDeps } from "../../src/agents/core/types";
import { cards } from "../../src/agents/core/registry";
import { agentRouter } from "../../src/api/agent";
import type { AppContext } from "../../src/env";
import { call, fakeDeps, fakeServices } from "../agents/fakes";

const prepOutput = {
  questions: Array.from({ length: 5 }, (_, i) => ({ text: `Question ${i}`, why: "Practice.", reported: false })),
  focus: ["testing"],
};

function testApp(deps: AgentDeps) {
  const pending: Promise<unknown>[] = [];
  const executionCtx = { waitUntil: (p: Promise<unknown>) => pending.push(p), passThroughOnException: () => {}, props: {} } as unknown as ExecutionContext;
  const app = new Hono<AppContext>()
    .use(async (c, next) => {
      c.set("sessionId", c.req.header("x-test-user") ?? "u1");
      await next();
    })
    .route("/", agentRouter(() => deps));

  const post = (path: string, body: unknown) =>
    app.request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) }, env, executionCtx);
  const get = (path: string, user = "u1") => app.request(path, { headers: { "x-test-user": user } }, env, executionCtx);
  return { post, get, pending };
}

describe("agent routes", () => {
  beforeEach(async () => {
    await env.DB.prepare("INSERT INTO companies (id, slug, name, website) VALUES ('c1', 'acme', 'Acme', 'https://acme.com')").run();
  });

  it("lists every agent's card", async () => {
    const res = await testApp(fakeDeps().deps).get("/cards");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(cards());
  });

  it("404s an unknown skill", async () => {
    const { post } = testApp(fakeDeps().deps);
    expect((await post("/nope", { platform: "app", input: {} })).status).toBe(404);
  });

  it("400s a bad platform, bad JSON or bad input", async () => {
    const { post } = testApp(fakeDeps().deps);
    expect((await post("/interview-prep", { platform: "tv", input: { company: "acme" } })).status).toBe(400);
    expect((await post("/interview-prep", "{not json")).status).toBe(400);
    expect((await post("/interview-prep", { platform: "app", input: { role: "Dev" } })).status).toBe(400);
    expect((await post("/career-snapshot", { platform: "vr", input: {} })).status).toBe(400);
  });

  it("404s an unknown company", async () => {
    const { post } = testApp(fakeDeps().deps);
    expect((await post("/interview-prep", { platform: "app", input: { company: "nope" } })).status).toBe(404);
  });

  it("runs an app skill and answers with its output", async () => {
    const { post } = testApp(fakeDeps({ replies: [call("finish", prepOutput)] }).deps);
    const res = await post("/interview-prep", { platform: "vr", input: { company: "acme" } });
    expect(res.status).toBe(200);
    const body = await res.json<{ runId: string; output: unknown }>();
    expect(body.runId).toEqual(expect.any(String));
    expect(body.output).toEqual(prepOutput);
  });

  it("answers 502 with the run id when the agent fails", async () => {
    const { post } = testApp(fakeDeps({ replies: [{ role: "model", parts: [{ text: "no finish" }] }] }).deps);
    const res = await post("/interview-prep", { platform: "app", input: { company: "acme" } });
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ runId: expect.any(String) });
  });

  it("starts a background-only skill and answers 202 before it finishes", async () => {
    const { post, get, pending } = testApp(fakeDeps({ replies: [call("finish", { summary: "nothing new" })] }).deps);
    const res = await post("/research-company", { platform: "background", input: { company: "acme" } });
    expect(res.status).toBe(202);
    const { runId } = await res.json<{ runId: string }>();
    expect(pending).toHaveLength(1);
    await Promise.all(pending);
    const run = await (await get(`/runs/${runId}`)).json();
    expect(run).toMatchObject({ id: runId, skill: "research-company", status: "done", output: { summary: "nothing new" } });
  });

  it("429s a background skill that is on cooldown", async () => {
    const { deps } = fakeDeps({ services: fakeServices({ claimResearch: async () => false }) });
    const res = await testApp(deps).post("/research-company", { platform: "background", input: { company: "acme" } });
    expect(res.status).toBe(429);
  });

  it("shows a run only to the person who started it", async () => {
    const { post, get } = testApp(fakeDeps({ replies: [call("finish", prepOutput)] }).deps);
    const { runId } = await (await post("/interview-prep", { platform: "app", input: { company: "acme" } })).json<{ runId: string }>();
    expect((await get(`/runs/${runId}`, "u1")).status).toBe(200);
    expect((await get(`/runs/${runId}`, "someone-else")).status).toBe(404);
  });
});
