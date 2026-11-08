import { Hono } from "hono";
import type { AppContext } from "../env";
import { generateFor, OPEN_GAP_MS } from "../notifications/generate";
import { type Pusher, pushPending } from "../notifications/push";
import { isQuietHours, isValidTimezone } from "../notifications/rules";
import { claimCheck, loadSettings, removeDevice, saveDevice, saveSettings } from "../notifications/settings";
import { decodeCursor, listNotifications, markRead, unreadCount } from "../notifications/store";
import { isNotificationKind, NOTIFICATION_KINDS, type NotificationKind, type NotificationSettings } from "../notifications/types";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 50;
// APNs device tokens are hex; 64 characters today, longer allowed because Apple says not to hard-code the length
const DEVICE_TOKEN = /^[0-9a-f]{32,200}$/i;

const kindsView = (settings: NotificationSettings) => Object.fromEntries(NOTIFICATION_KINDS.map((k) => [k, !settings.disabled.includes(k)]));

const parseLimit = (value: string | undefined) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? Math.min(n, MAX_LIMIT) : DEFAULT_LIMIT;
};

// the toggles arrive as {kind: on}; anything unknown or non-boolean is ignored rather than rejected
function disabledFrom(kinds: unknown, current: NotificationKind[]): NotificationKind[] | null {
  if (!kinds || typeof kinds !== "object" || Array.isArray(kinds)) return null;
  const next = new Set(current);
  for (const [kind, on] of Object.entries(kinds)) {
    if (!isNotificationKind(kind) || typeof on !== "boolean") continue;
    if (on) next.delete(kind);
    else next.add(kind);
  }
  return NOTIFICATION_KINDS.filter((k) => next.has(k));
}

/** /api/notifications: the person's own bell, its read state, which kinds they want, and where to push them. */
export function notificationsRouter(options: { pusher?: Pusher | null } = {}) {
  const router = new Hono<AppContext>();

  router.get("/", async (c) => {
    const userId = c.var.sessionId;
    const now = new Date();
    const tz = c.req.query("tz");
    const cursor = decodeCursor(c.req.query("cursor"));
    let settings = await loadSettings(c.env, userId);
    if (isValidTimezone(tz) && tz !== settings.timezone) settings = await saveSettings(c.env, userId, { timezone: tz }, now);
    // opening the bell is the cheapest moment to look for news, so the first page is never staler than a few minutes
    if (!cursor && (await claimCheck(c.env, userId, now, OPEN_GAP_MS))) {
      const created = await generateFor(c.env, userId, now);
      if (created > 0) c.executionCtx.waitUntil(pushPending(c.env, userId, now, options.pusher).catch((e) => console.error("push after open failed", e)));
    }
    const page = await listNotifications(c.env, userId, cursor, parseLimit(c.req.query("limit")));
    return c.json({ ...page, quiet: isQuietHours(now, settings.timezone) });
  });

  router.post("/read", async (c) => {
    const body = await c.req.json<{ ids?: unknown; all?: unknown }>().catch(() => null);
    const ids = Array.isArray(body?.ids) ? body.ids.filter((id): id is string => typeof id === "string") : null;
    if (body?.all !== true && !ids?.length) return c.json({ error: "send the ids to mark read, or all: true" }, 400);
    const userId = c.var.sessionId;
    const marked = await markRead(c.env, userId, body?.all === true ? "all" : ids!, new Date());
    return c.json({ marked, unread: await unreadCount(c.env, userId) });
  });

  router.get("/settings", async (c) => {
    const settings = await loadSettings(c.env, c.var.sessionId);
    return c.json({ timezone: settings.timezone, kinds: kindsView(settings) });
  });

  router.put("/settings", async (c) => {
    const body = await c.req.json<{ timezone?: unknown; kinds?: unknown }>().catch(() => null);
    if (!body) return c.json({ error: "send timezone and/or kinds" }, 400);
    if (body.timezone !== undefined && !isValidTimezone(body.timezone)) return c.json({ error: "timezone must be an IANA name such as America/Edmonton" }, 400);
    const userId = c.var.sessionId;
    const current = await loadSettings(c.env, userId);
    const disabled = disabledFrom(body.kinds, current.disabled);
    const saved = await saveSettings(c.env, userId, { timezone: body.timezone as string | undefined, disabled: disabled ?? undefined }, new Date());
    return c.json({ timezone: saved.timezone, kinds: kindsView(saved) });
  });

  router.post("/devices", async (c) => {
    const body = await c.req.json<{ token?: unknown; platform?: unknown }>().catch(() => null);
    if (typeof body?.token !== "string" || !DEVICE_TOKEN.test(body.token)) return c.json({ error: "send the APNs device token as hex" }, 400);
    if (body.platform !== undefined && body.platform !== "ios") return c.json({ error: "only ios devices take pushes" }, 400);
    await saveDevice(c.env, c.var.sessionId, body.token.toLowerCase(), new Date());
    return c.json({ ok: true }, 201);
  });

  router.delete("/devices", async (c) => {
    const body = await c.req.json<{ token?: unknown }>().catch(() => null);
    if (typeof body?.token !== "string") return c.json({ error: "send the token to forget" }, 400);
    const removed = await removeDevice(c.env, c.var.sessionId, body.token.toLowerCase());
    return removed ? c.body(null, 204) : c.json({ error: "unknown device" }, 404);
  });

  return router;
}

export const notifications = notificationsRouter();
