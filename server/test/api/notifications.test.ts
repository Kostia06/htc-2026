import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { notificationsRouter } from "../../src/api/notifications";
import { issueSession, requireSession, verifySession } from "../../src/auth/session";
import type { AppContext } from "../../src/env";
import { insertNotifications } from "../../src/notifications/store";
import type { Candidate, Notification } from "../../src/notifications/types";

type Page = { items: Notification[]; nextCursor: string | null; unread: number; quiet: boolean };

const app = new Hono<AppContext>();
app.use("*", requireSession);
app.route("/", notificationsRouter({ pusher: null }));

const executionCtx = { waitUntil: () => {}, passThroughOnException: () => {}, props: {} } as unknown as ExecutionContext;
const call = (token: string, path: string, init: RequestInit = {}) =>
  app.request(path, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }, env, executionCtx);
const send = (token: string, method: string, path: string, body: unknown) => call(token, path, { method, body: JSON.stringify(body) });

async function person() {
  const token = await issueSession(env.SESSION_SECRET);
  return { token, id: (await verifySession(token, env.SESSION_SECRET))! };
}

const note = (key: string): Candidate => ({ kind: "company_news", key, title: `Title ${key}`, body: "why", target: { type: "company", slug: "acme" } });

async function seeded(count: number) {
  const me = await person();
  for (let i = 0; i < count; i++) await insertNotifications(env, me.id, [note(`k${i}`)], new Date(Date.UTC(2026, 10, 1, 12, i)));
  return me;
}

describe("GET /api/notifications", () => {
  it("pages newest first with an unread count, and stores the timezone it was given", async () => {
    const me = await seeded(3);
    const first = await (await call(me.token, "/?limit=2&tz=America/Edmonton")).json<Page>();
    expect(first.items.map((n) => n.title)).toEqual(["Title k2", "Title k1"]);
    expect(first.unread).toBe(3);
    expect(first.nextCursor).toBeTruthy();
    const second = await (await call(me.token, `/?limit=2&cursor=${encodeURIComponent(first.nextCursor!)}`)).json<Page>();
    expect(second.items.map((n) => n.title)).toEqual(["Title k0"]);
    expect(second.nextCursor).toBeNull();
    const settings = await (await call(me.token, "/settings")).json<{ timezone: string }>();
    expect(settings.timezone).toBe("America/Edmonton");
  });

  it("never shows one person's notifications to another", async () => {
    await seeded(2);
    const stranger = await person();
    expect((await (await call(stranger.token, "/")).json<Page>()).items).toEqual([]);
  });

  it("needs a session", async () => {
    expect((await app.request("/", {}, env, executionCtx)).status).toBe(401);
  });
});

describe("POST /api/notifications/read", () => {
  it("marks chosen ids, then all, and only the caller's own", async () => {
    const me = await seeded(3);
    const other = await seeded(1);
    const { items } = await (await call(me.token, "/")).json<Page>();
    const [otherItem] = (await (await call(other.token, "/")).json<Page>()).items;

    const one = await (await send(me.token, "POST", "/read", { ids: [items[0]!.id, otherItem!.id] })).json<{ marked: number; unread: number }>();
    expect(one).toEqual({ marked: 1, unread: 2 });
    expect(await (await send(me.token, "POST", "/read", { all: true })).json()).toEqual({ marked: 2, unread: 0 });
    expect((await (await call(other.token, "/")).json<Page>()).unread).toBe(1);
    expect((await send(me.token, "POST", "/read", {})).status).toBe(400);
  });
});

describe("/api/notifications/settings", () => {
  it("turns kinds off and on and rejects a bogus timezone", async () => {
    const me = await person();
    const initial = await (await call(me.token, "/settings")).json<{ kinds: Record<string, boolean> }>();
    expect(Object.values(initial.kinds).every(Boolean)).toBe(true);
    const off = await (await send(me.token, "PUT", "/settings", { kinds: { feed_match: false, nonsense: false } })).json<{ kinds: Record<string, boolean> }>();
    expect(off.kinds.feed_match).toBe(false);
    expect(off.kinds).not.toHaveProperty("nonsense");
    const on = await (await send(me.token, "PUT", "/settings", { kinds: { feed_match: true }, timezone: "Europe/London" })).json<{ kinds: Record<string, boolean>; timezone: string }>();
    expect(on).toMatchObject({ timezone: "Europe/London", kinds: { feed_match: true } });
    expect((await send(me.token, "PUT", "/settings", { timezone: "Mars/Olympus" })).status).toBe(400);
  });
});

describe("/api/notifications/devices", () => {
  it("registers a hex APNs token and forgets it only for its owner", async () => {
    const me = await person();
    const stranger = await person();
    const token = "0f".repeat(32);
    expect((await send(me.token, "POST", "/devices", { token, platform: "ios" })).status).toBe(201);
    expect((await send(me.token, "POST", "/devices", { token: "not hex!" })).status).toBe(400);
    expect((await send(stranger.token, "DELETE", "/devices", { token })).status).toBe(404);
    expect((await send(me.token, "DELETE", "/devices", { token })).status).toBe(204);
  });
});
