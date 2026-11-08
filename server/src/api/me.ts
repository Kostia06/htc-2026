import { Hono } from "hono";
import type { AppContext } from "../env";
import { eraseUserData } from "../memory/erase";

export const me = new Hono<AppContext>();

// the session decides whose data goes: there is no way to name another account
me.delete("/", async (c) => c.json({ deleted: await eraseUserData(c.env, c.var.sessionId) }));
