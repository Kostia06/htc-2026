import { Hono } from "hono";
import { disconnectAll } from "../connections/connection";
import type { AppContext } from "../env";
import { eraseUserData } from "../memory/erase";
import { forgetUserRecordings } from "../replay/forget";

export const me = new Hono<AppContext>();

// the session decides whose data goes: there is no way to name another account.
// Recordings live at ElevenLabs and connected accounts at Composio; both go first, while we still know their ids.
// An outage there must not block erasing everything here, so anything left behind is reported instead.
me.delete("/", async (c) => {
  const userId = c.var.sessionId;
  const recordingsLeft = await forgetUserRecordings(c.env, userId);
  const connectionsLeft = await disconnectAll(c.env, userId);
  const deleted = await eraseUserData(c.env, userId);
  return c.json({
    deleted,
    ...(recordingsLeft > 0 ? { recordingsLeft } : {}),
    ...(connectionsLeft.length ? { connectionsLeft } : {}),
    // kept for app builds that only know about GitHub
    ...(connectionsLeft.includes("github") ? { githubLeft: true } : {}),
  });
});
