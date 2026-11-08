import { Hono } from "hono";
import { hasReachedLimit, recordAttempt } from "../auth/mint-limit";
import { claimCode, isPairingCode, offerCode, offerStatus } from "../auth/pairing";
import { requireSession } from "../auth/session";
import type { AppContext } from "../env";

// only ten thousand codes, so wrong guesses are what's limited; a venue's shared Wi-Fi still gets five per ten minutes
const WRONG_GUESSES = { attempts: 5, windowMs: 10 * 60 * 1000 };

export const pairing = new Hono<AppContext>();

pairing.post("/offer", requireSession, async (c) => c.json(await offerCode(c.env, c.var.sessionId), 201));

pairing.get("/offer/:code", requireSession, async (c) => c.json({ status: await offerStatus(c.env, c.var.sessionId, c.req.param("code")) }));

// the headset has no account yet, so claiming needs no session
pairing.post("/claim", async (c) => {
  const body = await c.req.json<{ code?: unknown }>().catch(() => null);
  if (!isPairingCode(body?.code)) return c.json({ error: "send the 4-digit code from your phone" }, 400);
  if (await hasReachedLimit(c, "pairing-claim", WRONG_GUESSES)) return c.json({ error: "too many wrong codes, wait a few minutes" }, 429);

  const session = await claimCode(c.env, body.code, c.env.SESSION_SECRET);
  if (session) return c.json(session);
  await recordAttempt(c, "pairing-claim");
  return c.json({ error: "that code isn't right, check your phone" }, 404);
});
