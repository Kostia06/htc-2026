// The notification generator and stores on Postgres: the same SQL the Worker ships, through db(env).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import { generateFor, runNotificationCron } from "../src/notifications/generate";
import { pushPending } from "../src/notifications/push";
import { claimCheck, devicesFor, loadSettings, removeDevice, saveDevice, saveSettings } from "../src/notifications/settings";
import { decodeCursor, listNotifications, markRead } from "../src/notifications/store";
import { updateProfile } from "../src/memory/profile/store";
import { insertSteps } from "../src/roadmap/store";
import { openTestDatabase } from "./pglite";

let db: Awaited<ReturnType<typeof openTestDatabase>>;
let env: Env;
const NOW = new Date("2026-11-08T18:00:00.000Z");
const DAY = 86_400_000;
const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

beforeAll(async () => {
  db = await openTestDatabase();
  env = db.env;
});
afterAll(() => db.pg.close());

describe("notifications on Postgres", () => {
  it("generates from every source, dedupes, pages, marks read and pushes", async () => {
    const me = "pg-user-1";
    const card = (id: string, when?: string) => JSON.stringify({ id, kind: "event", title: `Event ${id}`, org: "Org", why: "near you", reasons: [], url: "u", source: "s", when });
    await db.pg.query("INSERT INTO feed_items (user_id, section, position, card) VALUES ($1, 'all', 0, $2)", [me, card("f1")]);
    await db.pg.query("INSERT INTO feed_actions (user_id, item_id, action, card, created_at) VALUES ($1, 'f2', 'save', $2, $3)", [me, card("f2", at(DAY)), at(-DAY)]);
    await db.pg.query("INSERT INTO companies (id, slug, name) VALUES ('c1', 'acme', 'Acme')");
    await db.pg.query("INSERT INTO voice_sessions (id, user_id, mode, company_slug, ciphertext, iv, status, created_at, finished_at, overall) VALUES ('v1', $1, 'interview', 'acme', 'c', 'i', 'finished', $2, $2, 80)", [me, at(-60_000)]);
    await db.pg.query("INSERT INTO experiences (id, company_id, role, questions_json, is_seeded, created_at) VALUES ('e1', 'c1', 'Analyst', '[\"Why us?\"]', 0, $1)", [at(-60_000)]);
    await insertSteps(env, me, 0, [{ kind: "course", title: "Finish SQL course", why: "w", detail: "d", estimate: "1 hour", label: "ready_now" }], "template");
    await db.pg.query("UPDATE roadmap_steps SET updated_at = $1 WHERE user_id = $2", [at(-5 * DAY), me]);

    expect(await generateFor(env, me, NOW)).toBe(3);
    expect(await generateFor(env, me, NOW)).toBe(0);
    const first = await listNotifications(env, me, null, 2);
    expect(first.unread).toBe(3);
    const rest = await listNotifications(env, me, decodeCursor(first.nextCursor!), 2);
    expect([...first.items, ...rest.items].map((n) => n.kind).sort()).toEqual(["deadline", "report_ready", "road_nudge"]);

    expect(await markRead(env, me, [first.items[0]!.id], NOW)).toBe(1);
    expect(await markRead(env, me, "all", NOW)).toBe(2);

    // a day later the rest of the candidates get their turn
    const later = new Date(NOW.getTime() + DAY + 60_000);
    expect(await generateFor(env, me, later)).toBe(2);

    await saveSettings(env, me, { timezone: "America/Edmonton", disabled: ["feed_match"] }, NOW);
    expect(await loadSettings(env, me)).toMatchObject({ timezone: "America/Edmonton", disabled: ["feed_match"] });
    await saveDevice(env, me, "ab".repeat(32), NOW);
    expect(await devicesFor(env, me)).toEqual(["ab".repeat(32)]);
    expect((await pushPending(env, me, later, async () => "sent")).pushed).toBe(2);
    expect(await removeDevice(env, me, "ab".repeat(32))).toBe(true);
  });

  it("claims a check once per gap and the cron picks people with a profile", async () => {
    await updateProfile(env, "pg-user-2", { targetRoles: ["Analyst"] });
    expect(await claimCheck(env, "pg-user-2", NOW, 600_000)).toBe(true);
    expect(await claimCheck(env, "pg-user-2", new Date(NOW.getTime() + 1000), 600_000)).toBe(false);
    expect(await runNotificationCron(env, new Date(NOW.getTime() + DAY), null)).toBe(0);
  });
});
