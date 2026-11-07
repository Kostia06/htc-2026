import { Hono } from "hono";
import { claimMintSlot } from "../auth/mint-limit";
import { type ApproveResult, approvePairing, createPairing, pollPairing } from "../auth/pairing";
import { requireSession } from "../auth/session";
import type { AppContext } from "../env";

const APPROVE_ERRORS: Record<Exclude<ApproveResult, "approved">, { status: 404 | 409 | 410; error: string }> = {
  not_found: { status: 404, error: "no headset is waiting with that code" },
  expired: { status: 410, error: "that code expired, show a new one on the headset" },
  already_used: { status: 409, error: "that code was already used" },
};

export const pairing = new Hono<AppContext>();

// the headset has no account yet, so creating and polling a code need no session
pairing.post("/", async (c) => {
  if (!(await claimMintSlot(c, "pairing"))) return c.json({ error: "too many codes, try again later" }, 429);
  return c.json(await createPairing(c.env), 201);
});

pairing.get("/:code", async (c) => {
  const result = await pollPairing(c.env, c.req.param("code"), c.req.header("X-Pairing-Token") ?? "");
  if (!result) return c.json({ error: "unknown code" }, 404);
  if (result.status === "expired") return c.json({ error: "this code is no longer valid" }, 410);
  return c.json(result);
});

pairing.post("/:code/approve", requireSession, async (c) => {
  const result = await approvePairing(c.env, c.req.param("code"), c.var.sessionId);
  if (result === "approved") return c.json({ paired: true });
  const { status, error } = APPROVE_ERRORS[result];
  return c.json({ error }, status);
});
