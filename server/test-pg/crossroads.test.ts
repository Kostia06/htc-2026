// Crossroads SQL on Postgres: the seed, the k>=3 counts, outcomes, research and the roadmap step, through db(env).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureExploreStep, finishExploreStep } from "../src/crossroads/explore-step";
import { interviewLines } from "../src/crossroads/interviews";
import { recordOutcome } from "../src/crossroads/outcome";
import { pathsFor } from "../src/crossroads/paths";
import { linesFor, standBehind } from "../src/crossroads/patterns";
import { researchFor } from "../src/crossroads/research";
import { businessLines } from "../src/crossroads/seed/lines-business";
import { peopleLines } from "../src/crossroads/seed/lines-people";
import { techLines } from "../src/crossroads/seed/lines-tech";
import { calgaryEmployers, seedTrails } from "../src/crossroads/seed/roads";
import { seedStatements } from "../src/crossroads/seed/statements";
import { crossroadsFor } from "../src/crossroads/view";
import type { Env } from "../src/env";
import { remember } from "../src/memory/private/store";
import { updateProfile } from "../src/memory/profile/store";
import { insertSteps, loadAll, setStepStatus } from "../src/roadmap/store";
import { openTestDatabase } from "./pglite";

let db: Awaited<ReturnType<typeof openTestDatabase>>;
let env: Env;
const statements = seedStatements([...techLines, ...businessLines, ...peopleLines], seedTrails, calgaryEmployers);

beforeAll(async () => {
  db = await openTestDatabase();
  env = db.env;
  // twice: the seed must be safe to rerun against production
  for (let round = 0; round < 2; round++) await db.database.batch(statements.map((s) => db.database.prepare(s.sql).bind(...s.params)));
});
afterAll(() => db.pg.close());

describe("crossroads on Postgres", () => {
  it("seeds idempotently and shows examples uncounted", async () => {
    const { n } = (await db.pg.query<{ n: number }>("SELECT count(*)::int AS n FROM road_patterns WHERE is_seeded = 1")).rows[0];
    expect(n).toBe(techLines.length + businessLines.length + peopleLines.length);
    const lines = await linesFor(env, "u1", "health");
    expect(lines.length).toBeGreaterThan(5);
    expect(lines.every((l) => l.example && l.people === null)).toBe(true);
  });

  it("counts distinct people behind a line and hides real ones below three", async () => {
    await db.pg.exec("INSERT INTO road_patterns (id, lane, kind, text, is_seeded, created_at) VALUES ('pg_real', 'trades', 'tip', 'Get the safety tickets first', 0, '2026-11-08')");
    for (const user of ["a", "b"]) await standBehind(env, user, "pg_real", true);
    await standBehind(env, "a", "pg_real", true);
    expect((await linesFor(env, "a", "trades")).find((l) => l.id === "pg_real")).toBeUndefined();
    expect(await standBehind(env, "c", "pg_real", true)).toMatchObject({ line: { people: 3, meToo: true } });
  });

  it("aggregates outcomes into trails only from three people", async () => {
    for (const user of ["p1", "p2", "p3"]) {
      await insertSteps(env, user, 0, [{ kind: "course", title: "t", why: "w", detail: "d", estimate: "e", label: "ready_now" }], "template");
      const [step] = await loadAll(env, user);
      await setStepStatus(env, user, step.id, "done", undefined);
      await recordOutcome(env, user, { role: "Electrical apprentice", share: true });
    }
    const { trails, badges } = await pathsFor(env, "trades", "Electrical apprentice");
    expect(trails[0]).toMatchObject({ role: "Electrical Apprentice", people: 3, example: false, steps: ["course"] });
    expect(badges).toEqual([{ kind: "course", people: 3, reached: "Electrical Apprentice" }]);
  });

  it("only counts reported interview questions from three different people", async () => {
    await db.pg.exec("INSERT INTO companies (id, slug, name) VALUES ('c_pg', 'pg-co', 'PG Co') ON CONFLICT DO NOTHING");
    const add = (id: string, who: string) =>
      db.pg.query("INSERT INTO experiences (id, company_id, role, questions_json, is_seeded, created_at, contributor) VALUES ($1, 'c_pg', 'Teacher', '[\"Why teaching?\"]', 0, '2026-11-08', $2)", [id, who]);
    await add("x1", "same");
    await add("x2", "same");
    await add("x3", "other");
    expect(await interviewLines(env, "education")).toEqual([]);
    await add("x4", "third");
    expect(await interviewLines(env, "education")).toMatchObject([{ text: "Why teaching?", people: 3, example: false }]);
  });

  it("builds the whole screen without embeddings and finishes the roadmap step", async () => {
    await updateProfile(env, "me", { targetRoles: ["Registered nurse"] });
    await remember(env, "me", { kind: "weakness", text: "Situational interview questions make me freeze" });
    await db.pg.exec(
      "INSERT INTO company_facts (id, company_id, kind, text, source_url, fetched_at, content_hash) VALUES ('f_ahs', 'co_alberta-health-services', 'hiring', 'Casual RN postings open year round', 'https://www.albertahealthservices.ca/careers', '2026-11-01T00:00:00Z', 'h_ahs')",
    );
    expect(await ensureExploreStep(env, "me", "Registered nurse")).toBe(true);

    const view = await crossroadsFor(env, "me");
    expect(view.road.lane).toBe("health");
    expect(view.links.some((l) => l.everyone === "ex_health_struggle_2")).toBe(true);
    expect((await researchFor(env, "me", "health"))[0]).toMatchObject({ company: "Alberta Health Services", sourceHost: "albertahealthservices.ca" });

    await finishExploreStep(env, "me");
    expect((await loadAll(env, "me"))[0]).toMatchObject({ kind: "explore_memory", status: "done" });
  });
});
