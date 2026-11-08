import { Hono } from "hono";
import { hasReachedLimit, recordAttempt } from "../auth/mint-limit";
import type { AppContext } from "../env";
import { isHeadsetConnected, listHeadsets, refreshHeadset, revokeHeadset, touchHeadset } from "../headset/devices";
import { MAX_WAIT_MS, parseLaunch, queueLaunch, waitForLaunch } from "../headset/launch";
import { claimCooldown } from "../memory/cooldowns";

// a refresh credential is long and random, so this only slows down someone spraying guesses from one network
const BAD_REFRESHES = { attempts: 10, windowMs: 10 * 60 * 1000 };
// the page long-polls for 20 s at a time; anything polling faster than once a second is a loop, not a headset
const MIN_POLL_GAP_MS = 1000;

export const headset = new Hono<AppContext>();

// the headset's access token may have run out, so refreshing needs no session (index.ts lets this path through)
headset.post("/refresh", async (c) => {
  const body = await c.req.json<{ refreshToken?: unknown }>().catch(() => null);
  if (typeof body?.refreshToken !== "string" || !body.refreshToken) return c.json({ error: "send the headset's refresh token" }, 400);
  if (await hasReachedLimit(c, "headset-refresh", BAD_REFRESHES)) return c.json({ error: "too many attempts, wait a few minutes" }, 429);

  const creds = await refreshHeadset(c.env, body.refreshToken, c.env.SESSION_SECRET);
  if (creds) return c.json(creds);
  await recordAttempt(c, "headset-refresh");
  return c.json({ error: "this headset needs to sign in again" }, 401);
});

// phone: list and forget headsets
headset.get("/devices", async (c) => c.json({ devices: await listHeadsets(c.env, c.var.sessionId) }));

headset.delete("/devices/:id", async (c) => {
  const revoked = await revokeHeadset(c.env, c.var.sessionId, c.req.param("id"));
  // a body rather than 204: the phone's client decodes every success as JSON
  return revoked ? c.json({ revoked: true }) : c.json({ error: "no such headset" }, 404);
});

headset.get("/status", async (c) => {
  const now = new Date();
  return c.json({ connected: await isHeadsetConnected(c.env, c.var.sessionId, now), devices: await listHeadsets(c.env, c.var.sessionId, now) });
});

// phone: ask the headset to start a session
headset.post("/launch", async (c) => {
  const launch = parseLaunch(await c.req.json().catch(() => null));
  if (!launch) return c.json({ error: "mode must be interview or networking" }, 400);
  const now = new Date();
  const { expiresAt } = await queueLaunch(c.env, c.var.sessionId, launch, now);
  return c.json({ expiresAt, connected: await isHeadsetConnected(c.env, c.var.sessionId, now) }, 201);
});

// headset: pick up a pending launch; `device` is the id from pairing, `wait` (seconds) long-polls
headset.get("/launch", async (c) => {
  const userId = c.var.sessionId;
  const now = new Date();
  const waitMs = Math.min(Math.max(Number(c.req.query("wait") ?? 0) || 0, 0) * 1000, MAX_WAIT_MS);
  const deviceId = c.req.query("device");
  if (deviceId) {
    if ((await touchHeadset(c.env, userId, deviceId, now)) === "unknown") return c.json({ error: "this headset needs to sign in again" }, 401);
    if (!(await claimCooldown(c.env, "headset-poll", deviceId, MIN_POLL_GAP_MS, now))) {
      return c.json({ error: "polling too fast" }, 429, { "Retry-After": "1" });
    }
  }
  const launch = await waitForLaunch(c.env, userId, waitMs);
  // a long poll counts as present for its whole duration
  if (deviceId && waitMs > 0) await touchHeadset(c.env, userId, deviceId, new Date());
  return c.json({ launch });
});
