import { Hono } from "hono";
import type { AppContext } from "../env";
import { eraseUserData } from "../memory/erase";
import { forgetUserRecordings } from "../replay/forget";

export const me = new Hono<AppContext>();

// the session decides whose data goes: there is no way to name another account.
// Recordings live at ElevenLabs and go first, while we still know their ids; an outage there must not
// block erasing everything here, so any left behind are reported instead.
me.delete("/", async (c) => {
  const userId = c.var.sessionId;
  const recordingsLeft = await forgetUserRecordings(c.env, userId);
  const deleted = await eraseUserData(c.env, userId);
  return c.json(recordingsLeft > 0 ? { deleted, recordingsLeft } : { deleted });
});
