import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../src/index";
import type { Crossroads } from "../../src/crossroads/view";
import { insertSteps, loadAll, setStepStatus } from "../../src/roadmap/store";
import { addRealLine, executionCtx, person, seedCrossroads, useFakeEmbeddings } from "./helpers";

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const get = (token: string) => app.request("/api/crossroads", { headers: auth(token) }, env, executionCtx);
const add = (token: string, id: string) => app.request(`/api/crossroads/lines/${id}/add-to-road`, { method: "POST", headers: auth(token) }, env, executionCtx);

describe("POST /api/crossroads/lines/:id/add-to-road", () => {
  beforeEach(async () => {
    useFakeEmbeddings();
    await seedCrossroads();
  });

  it("turns a tip into a step on the person's road once, and the screen then marks it added", async () => {
    const me = await person("Junior data analyst");
    await addRealLine("real_tip", "data", "Rebuilt a city open data dashboard as a portfolio piece", 4);

    expect((await add(me.token, "real_tip")).status).toBe(201);
    expect((await add(me.token, "real_tip")).status).toBe(200);
    const steps = await loadAll(env, me.id);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ kind: "project", title: "Rebuilt a city open data dashboard as a portfolio piece", status: "todo", source: "agent" });
    expect(steps[0].why).toBe("4 people on your road said this worked.");

    const view = await (await get(me.token)).json<Crossroads>();
    expect(view.yourRoad.added).toEqual(["real_tip"]);
  });

  it("says an example is an example rather than counting it as people", async () => {
    const me = await person("Junior data analyst");
    expect((await add(me.token, "ex_data_tip_1")).status).toBe(201);
    const [step] = await loadAll(env, me.id);
    expect(step.why).toMatch(/^An example from your road/);
  });

  it("refuses struggles, unknown lines and real lines still under three people", async () => {
    const me = await person("Junior data analyst");
    await addRealLine("hidden_tip", "data", "Only two people said this", 2);
    expect((await add(me.token, "ex_data_struggle_1")).status).toBe(400);
    expect((await add(me.token, "no_such_line")).status).toBe(404);
    expect((await add(me.token, "hidden_tip")).status).toBe(404);
    expect(await loadAll(env, me.id)).toHaveLength(0);
  });
});

describe("GET /api/crossroads yourRoad", () => {
  beforeEach(async () => {
    useFakeEmbeddings();
    await seedCrossroads();
  });

  it("lists the step kinds the person finished, once each, and nothing from anyone else", async () => {
    const me = await person("Junior data analyst");
    const someoneElse = await person("Junior data analyst");
    const content = (kind: "course" | "project") => ({ kind, title: `t ${kind}`, why: "w", detail: "d", estimate: "1 h", label: "ready_now" as const });
    await insertSteps(env, me.id, 0, [content("course"), content("course"), content("project")], "template");
    const [first, second] = await loadAll(env, me.id);
    await setStepStatus(env, me.id, first.id, "done", undefined);
    await setStepStatus(env, me.id, second.id, "done", undefined);
    await insertSteps(env, someoneElse.id, 0, [content("project")], "template");
    const [theirs] = await loadAll(env, someoneElse.id);
    await setStepStatus(env, someoneElse.id, theirs.id, "done", undefined);

    const view = await (await get(me.token)).json<Crossroads>();
    expect(view.yourRoad).toEqual({ done: ["course"], added: [] });
  });
});
