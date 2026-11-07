import { Hono } from "hono";
import { claimMintSlot } from "../auth/mint-limit";
import { issueSession } from "../auth/session";
import type { AppContext } from "../env";

export const session = new Hono<AppContext>();

session.post("/", async (c) => {
  if (!(await claimMintSlot(c, "session"))) return c.json({ error: "too many new sessions, try again later" }, 429);
  return c.json({ token: await issueSession(c.env.SESSION_SECRET) });
});
