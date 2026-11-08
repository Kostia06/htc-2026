import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { generateFor, refreshNotifications } from "../../src/notifications/generate";
import { pushPending } from "../../src/notifications/push";
import { devicesFor, saveDevice, saveSettings } from "../../src/notifications/settings";
import { listNotifications } from "../../src/notifications/store";
import type { FeedCard } from "../../src/feed/types";
import { insertSteps } from "../../src/roadmap/store";
import { saveTailored } from "../../src/resume/tailor/store";
import type { TailoredContent } from "../../src/resume/tailor/types";

const NOW = new Date("2026-11-08T18:00:00Z"); // 11:00 in Calgary
const iso = (msFromNow: number) => new Date(NOW.getTime() + msFromNow).toISOString();
const DAY = 86_400_000;

const newUser = () => crypto.randomUUID();
const card = (id: string, over: Partial<FeedCard> = {}): FeedCard => ({ id, kind: "job", title: `Job ${id}`, org: "Acme", why: "Matches your SQL", reasons: [], url: "https://x.test", source: "test", ...over });

const putFeed = (userId: string, cards: FeedCard[]) =>
  env.DB.batch(cards.map((c, i) => env.DB.prepare("INSERT INTO feed_items (user_id, section, position, card) VALUES (?, 'all', ?, ?)").bind(userId, i, JSON.stringify(c))));
const save = (userId: string, c: FeedCard) =>
  env.DB.prepare("INSERT INTO feed_actions (user_id, item_id, action, card, created_at) VALUES (?, ?, 'save', ?, ?)").bind(userId, c.id, JSON.stringify(c), iso(-DAY)).run();
const finishedReport = (userId: string, id: string, at: string) =>
  env.DB.prepare("INSERT INTO voice_sessions (id, user_id, mode, ciphertext, iv, status, created_at, finished_at, overall) VALUES (?, ?, 'interview', 'c', 'i', 'finished', ?, ?, 74)").bind(id, userId, at, at).run();
const kinds = async (userId: string) => (await listNotifications(env, userId, null, 50)).items.map((n) => n.kind).sort();

describe("generateFor", () => {
  it("tells someone about their top feed match, a saved deadline and a finished report, once each", async () => {
    const me = newUser();
    await putFeed(me, [card("top"), card("second"), card("third")]);
    await save(me, card("hack", { kind: "hackathon", title: "Calgary Hacks", when: iso(2 * DAY) }));
    await finishedReport(me, "vs-1", iso(-3600_000));

    expect(await generateFor(env, me, NOW)).toBe(3);
    expect(await kinds(me)).toEqual(["deadline", "feed_match", "report_ready"]);
    const { items } = await listNotifications(env, me, null, 50);
    expect(items.find((n) => n.kind === "deadline")).toMatchObject({ title: "Calgary Hacks is in 2 days", target: { type: "feed", id: "hack" }, readAt: null });
    expect(items.find((n) => n.kind === "report_ready")?.body).toContain("You scored 74");

    // a day later only the second feed card is still unsaid; nothing already said comes back
    expect(await generateFor(env, me, new Date(NOW.getTime() + DAY + 60_000))).toBe(1);
    expect(await kinds(me)).toEqual(["deadline", "feed_match", "feed_match", "report_ready"]);
  });

  it("stops at three a day and lets the rest through on a later day", async () => {
    const me = newUser();
    await putFeed(me, [card("a"), card("b")]);
    await save(me, card("d1", { when: iso(DAY) }));
    await save(me, card("d2", { when: iso(2 * DAY) }));
    await finishedReport(me, "vs-2", iso(-60_000));

    expect(await generateFor(env, me, NOW)).toBe(3);
    expect(await kinds(me)).toEqual(["deadline", "deadline", "report_ready"]);
    expect(await generateFor(env, me, new Date(NOW.getTime() + 3600_000))).toBe(0);
    expect(await generateFor(env, me, new Date(NOW.getTime() + DAY + 60_000))).toBe(2);
  });

  it("skips kinds the person turned off", async () => {
    const me = newUser();
    await putFeed(me, [card("a")]);
    await saveSettings(env, me, { disabled: ["feed_match"] }, NOW);
    expect(await generateFor(env, me, NOW)).toBe(0);
  });

  it("nudges about the current Road step once it has sat three days, not before", async () => {
    const me = newUser();
    await insertSteps(env, me, 0, [{ kind: "project", title: "Build a SQL dashboard", why: "w", detail: "d", estimate: "2 hours", label: "ready_now" }], "template");
    await env.DB.prepare("UPDATE roadmap_steps SET updated_at = ? WHERE user_id = ?").bind(iso(-2 * DAY), me).run();
    expect(await generateFor(env, me, NOW)).toBe(0);
    await env.DB.prepare("UPDATE roadmap_steps SET updated_at = ? WHERE user_id = ?").bind(iso(-4 * DAY), me).run();
    expect(await generateFor(env, me, NOW)).toBe(1);
    const [nudge] = (await listNotifications(env, me, null, 5)).items;
    expect(nudge).toMatchObject({ kind: "road_nudge", title: "Next on your Road: Build a SQL dashboard", target: { type: "step" } });
  });

  it("tells about new questions and research at companies the person is going for, and not at others", async () => {
    const me = newUser();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO companies (id, slug, name) VALUES ('c1', 'shopify', 'Shopify'), ('c2', 'other', 'Other')"),
      env.DB.prepare("INSERT INTO user_postings (id, user_id, company_slug, ciphertext, iv, created_at) VALUES ('p1', ?, 'shopify', 'c', 'i', ?)").bind(me, iso(-DAY)),
      env.DB.prepare("INSERT INTO experiences (id, company_id, role, questions_json, is_seeded, created_at) VALUES ('e1', 'c1', 'Data analyst', ?, 0, ?)").bind(JSON.stringify(["Walk me through a messy join"]), iso(-3600_000)),
      env.DB.prepare("INSERT INTO experiences (id, company_id, role, questions_json, is_seeded, created_at) VALUES ('e2', 'c2', 'Dev', '[\"q\"]', 0, ?)").bind(iso(-3600_000)),
      env.DB.prepare("INSERT INTO company_facts (id, company_id, kind, text, source_url, fetched_at, content_hash) VALUES ('f1', 'c1', 'hiring', 'Shopify opened 40 data roles', 'https://s.test', ?, 'h1')").bind(iso(-3600_000)),
    ]);
    expect(await generateFor(env, me, NOW)).toBe(2);
    const { items } = await listNotifications(env, me, null, 5);
    expect(items.map((n) => n.title).sort()).toEqual(["New interview question at Shopify", "New on Shopify"]);
    expect(items.find((n) => n.kind === "interview_question")?.body).toBe("Data analyst: “Walk me through a messy join”");
    expect(items.every((n) => n.target.type === "company" && n.target.slug === "shopify")).toBe(true);
  });

  it("tells when a tailored resume is ready", async () => {
    const me = newUser();
    await saveTailored(env, me, { postingId: "po", title: "Data Analyst", company: "Acme" } as TailoredContent, new Date(NOW.getTime() - 60_000));
    expect(await generateFor(env, me, NOW)).toBe(1);
    expect((await listNotifications(env, me, null, 5)).items[0]).toMatchObject({ kind: "resume_ready", body: "Adapted for Data Analyst at Acme. Review the changes." });
  });
});

describe("pushPending", () => {
  const TOKEN = "ab".repeat(32);

  it("pushes new notifications to the person's devices once, and forgets tokens APNs calls dead", async () => {
    const me = newUser();
    await saveSettings(env, me, { timezone: "America/Edmonton" }, NOW);
    await saveDevice(env, me, TOKEN, NOW);
    await saveDevice(env, me, "cd".repeat(32), NOW);
    await putFeed(me, [card("a")]);
    await generateFor(env, me, NOW);
    const sent: string[] = [];
    const pusher = async (token: string) => {
      sent.push(token);
      return token === TOKEN ? ("sent" as const) : ("dead-token" as const);
    };
    expect((await pushPending(env, me, NOW, pusher)).pushed).toBe(1);
    expect(sent.sort()).toEqual(["abababababababababababababababababababababababababababababababab", "cd".repeat(32)].sort());
    expect(await devicesFor(env, me)).toEqual([TOKEN]);
    expect((await pushPending(env, me, NOW, pusher)).pushed).toBe(0);
    expect((await listNotifications(env, me, null, 5)).items[0]?.pushed).toBe(true);
  });

  it("holds pushes during the person's quiet hours", async () => {
    const me = newUser();
    await saveSettings(env, me, { timezone: "America/Edmonton" }, NOW);
    await saveDevice(env, me, TOKEN, NOW);
    await putFeed(me, [card("a")]);
    const night = new Date("2026-11-09T05:00:00Z"); // 22:00 in Calgary
    let calls = 0;
    const result = await refreshNotifications(env, me, { now: night, pusher: async () => (calls++, "sent") });
    expect(result).toEqual({ created: 1, pushed: 0 });
    expect(calls).toBe(0);
    // the next morning the held one goes out
    expect((await pushPending(env, me, new Date("2026-11-09T15:30:00Z"), async () => (calls++, "sent"))).pushed).toBe(1);
  });

  it("does nothing when APNs isn't configured", async () => {
    const me = newUser();
    expect(await pushPending(env, me, NOW)).toEqual({ pushed: 0, skipped: "push not configured" });
  });
});
