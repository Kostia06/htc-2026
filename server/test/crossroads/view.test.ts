import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../src/index";
import { ensureExploreStep } from "../../src/crossroads/explore-step";
import type { Crossroads } from "../../src/crossroads/view";
import { remember } from "../../src/memory/private/store";
import { loadAll } from "../../src/roadmap/store";
import { addRealLine, executionCtx, person, seedCrossroads, useFakeEmbeddings } from "./helpers";

const get = (token: string) => app.request("/api/crossroads", { headers: { Authorization: `Bearer ${token}` } }, env, executionCtx);
const meToo = (token: string, id: string, method = "POST") =>
  app.request(`/api/crossroads/lines/${id}/me-too`, { method, headers: { Authorization: `Bearer ${token}` } }, env, executionCtx);

describe("GET /api/crossroads", () => {
  beforeEach(async () => {
    useFakeEmbeddings();
    await seedCrossroads();
  });

  it("puts the person's own notes next to their road and links the ones that overlap", async () => {
    const me = await person("Junior data analyst");
    const note = await remember(env, me.id, { kind: "weakness", text: "Froze when asked to write SQL joins without autocomplete" });

    const res = await get(me.token);
    expect(res.status).toBe(200);
    const view = await res.json<Crossroads>();
    expect(view.road).toEqual({ goal: "Junior data analyst", lane: "data", laneName: "data" });
    expect(view.you.find((y) => y.id === note.id)).toMatchObject({ kind: "weakness", source: "memory" });
    const link = view.links.find((l) => l.you === note.id);
    expect(link?.everyone).toBe("ex_data_struggle_1");
    // the linked line comes first, so the strongest overlap is the first thing on the screen
    expect(view.everyone[0].id).toBe("ex_data_struggle_1");
    expect(view.minPeople).toBe(3);
  });

  it("shows seeded lines as examples with no count and never another road's lines", async () => {
    const me = await person("Junior data analyst");
    const view = await (await get(me.token)).json<Crossroads>();
    expect(view.everyone.length).toBeGreaterThan(5);
    expect(view.everyone.every((l) => l.example && l.people === null)).toBe(true);
    expect(view.everyone.some((l) => l.id.startsWith("ex_software"))).toBe(false);
    expect(view.trails.every((t) => t.example && t.people === null)).toBe(true);
    expect(view.trails[0].role).toBe("Junior Data Analyst");
  });

  it("hides a real line until three different people stand behind it, and never returns who they are", async () => {
    const me = await person("Junior data analyst");
    await addRealLine("real_two", "data", "Mock interviews with a friend helped most", 2);
    await addRealLine("real_three", "data", "Local open data made the best portfolio piece", 3);

    const view = await (await get(me.token)).json<Crossroads>();
    expect(view.everyone.find((l) => l.id === "real_two")).toBeUndefined();
    expect(view.everyone.find((l) => l.id === "real_three")).toMatchObject({ people: 3, example: false, meToo: false });
    const raw = JSON.stringify(view);
    expect(raw).not.toContain("voter-");
    expect(raw).not.toContain("user_id");

    // the person's own "me too" is what lifts the hidden line over the bar
    const res = await meToo(me.token, "real_two");
    expect(await res.json()).toMatchObject({ meToo: true, line: { id: "real_two", people: 3, meToo: true } });
    const undone = await meToo(me.token, "real_two", "DELETE");
    expect(await undone.json()).toEqual({ meToo: false, line: null });
    expect((await meToo(me.token, "no_such_line")).status).toBe(404);
  });

  it("keeps an example flagged even once real people say me too", async () => {
    const me = await person("Junior data analyst");
    for (const voter of ["a", "b"]) {
      await env.DB.prepare("INSERT INTO road_pattern_votes (pattern_id, user_id, created_at) VALUES ('ex_data_tip_1', ?, ?)").bind(voter, new Date().toISOString()).run();
    }
    const res = await meToo(me.token, "ex_data_tip_1");
    expect(await res.json()).toMatchObject({ line: { example: true, people: 3, meToo: true } });
  });

  it("lists research facts for employers on the road with their source and age", async () => {
    const me = await person("Junior data analyst");
    const fetched = new Date(Date.now() - 3 * 86_400_000).toISOString();
    await env.DB.prepare(
      "INSERT INTO company_facts (id, company_id, kind, text, source_url, fetched_at, content_hash) VALUES ('f_arc', 'co_arcurve', 'hiring', 'Hires junior data developers each spring', 'https://www.arcurve.com/careers', ?, 'h_arc')",
    ).bind(fetched).run();

    const view = await (await get(me.token)).json<Crossroads>();
    expect(view.research).toEqual([
      expect.objectContaining({ id: "f_arc", company: "Arcurve", slug: "arcurve", sourceUrl: "https://www.arcurve.com/careers", sourceHost: "arcurve.com", ageDays: 3 }),
    ]);
  });

  it("finishes the person's Crossroads step when they open it", async () => {
    const me = await person("Junior data analyst");
    expect(await ensureExploreStep(env, me.id, "Junior data analyst")).toBe(true);
    expect(await ensureExploreStep(env, me.id, "Junior data analyst")).toBe(false);
    await get(me.token);
    const [step] = await loadAll(env, me.id);
    expect(step).toMatchObject({ kind: "explore_memory", status: "done", action: { type: "crossroads" } });
    expect(step.title).toBe("See what others learned on the road to Junior data analyst");
  });
});
