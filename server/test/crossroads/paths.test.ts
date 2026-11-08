import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import app from "../../src/index";
import { preferTravelled } from "../../src/crossroads/boost";
import { pathsFor } from "../../src/crossroads/paths";
import { listMemories } from "../../src/memory/private/store";
import { insertSteps, loadAll, setStepStatus } from "../../src/roadmap/store";
import type { Step, StepContent, StepKind } from "../../src/roadmap/types";
import { executionCtx, person, seedCrossroads } from "./helpers";

const content = (kind: StepKind, title = `Secret ${kind} title`): StepContent => ({ kind, title, why: "w", detail: "d", estimate: "1 h", label: "ready_now" });
const step = (id: string, kind: StepKind): Step => ({ ...content(kind), id, status: "todo", completedAt: null, note: null, source: "template" });

const report = (token: string, body: unknown) =>
  app.request("/api/me/outcome", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }, env, executionCtx);

async function finished(userId: string, kinds: StepKind[]) {
  await insertSteps(env, userId, 0, kinds.map((k) => content(k)), "template");
  for (const s of await loadAll(env, userId)) await setStepStatus(env, userId, s.id, "done", "my private note");
}

async function reachedRole(role: string, kinds: StepKind[]) {
  const someone = await person(role);
  await finished(someone.id, kinds);
  expect((await report(someone.token, { role, share: true })).status).toBe(201);
}

describe("POST /api/me/outcome", () => {
  it("keeps the news privately and shares nothing unless asked", async () => {
    const me = await person();
    await finished(me.id, ["course", "project"]);
    const res = await report(me.token, { role: "Junior data analyst" });
    expect(await res.json()).toEqual({ shared: false, steps: ["course", "project"], skills: [] });
    expect((await listMemories(env, me.id)).map((m) => m.text)).toContain("Got the job: Junior data analyst");
    const rows = await env.DB.prepare("SELECT count(*) AS n FROM path_outcomes").first<{ n: number }>();
    expect(rows?.n).toBe(0);
  });

  it("shares only step kinds and skill names, never step text, notes or dates", async () => {
    const me = await person();
    await finished(me.id, ["course", "project"]);
    await report(me.token, { role: "Junior Data Analyst", company: "not-a-known-company", share: true });
    const row = await env.DB.prepare("SELECT * FROM path_outcomes WHERE user_id = ?").bind(me.id).first<Record<string, unknown>>();
    expect(row).toMatchObject({ lane: "data", role: "junior data analyst", company_slug: null, steps_json: '["course","project"]' });
    expect(JSON.stringify(row)).not.toMatch(/Secret|private note|20\d\d-/);
  });

  it("refuses a missing role or a non-boolean share", async () => {
    const me = await person();
    expect((await report(me.token, { share: true })).status).toBe(400);
    expect((await report(me.token, { role: "Analyst", share: "yes" })).status).toBe(400);
  });
});

describe("paths that worked", () => {
  it("shows no real trail or badge until three people reached the role", async () => {
    await reachedRole("Junior data analyst", ["course", "project", "application"]);
    await reachedRole("Junior data analyst", ["course", "project", "application"]);
    const two = await pathsFor(env, "data", "Junior data analyst");
    expect(two).toEqual({ trails: [], badges: [] });

    await reachedRole("Junior data analyst", ["course", "volunteering", "project", "application"]);
    const three = await pathsFor(env, "data", "Junior data analyst");
    // volunteering was one person's step, so it stays out of the shared trail
    expect(three.trails).toEqual([{ id: "trail_junior_data_analyst", role: "Junior Data Analyst", people: 3, example: false, steps: ["course", "project", "application"], skills: [] }]);
    expect(three.badges.map((b) => b.kind).sort()).toEqual(["application", "course", "project"]);
    expect(three.badges[0]).toMatchObject({ people: 3, reached: "Junior Data Analyst" });
  });

  it("lists seeded trails after real ones, flagged and uncounted", async () => {
    await seedCrossroads();
    const { trails, badges } = await pathsFor(env, "data", "Junior data analyst");
    expect(trails.length).toBe(2);
    expect(trails.every((t) => t.example && t.people === null)).toBe(true);
    expect(trails[0].role).toBe("Junior Data Analyst");
    expect(badges).toEqual([]);
  });

  it("lifts a travelled step at most one place and marks it", () => {
    const page = [step("a", "course"), step("b", "event"), step("c", "project"), step("d", "event")];
    const ordered = preferTravelled(page, [{ kind: "project", people: 4, reached: "Junior Data Analyst" }]);
    expect(ordered.map((s) => s.id)).toEqual(["a", "c", "b", "d"]);
    expect(ordered[1].travelled).toEqual({ people: 4, reached: "Junior Data Analyst" });
    expect(ordered[0].travelled).toBeUndefined();
  });
});
