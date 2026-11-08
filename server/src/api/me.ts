import { Hono } from "hono";
import { disconnectGithub } from "../connections/github/connection";
import type { AppContext } from "../env";
import { eraseUserData } from "../memory/erase";
import { forgetUserRecordings } from "../replay/forget";

export const me = new Hono<AppContext>();

// the session decides whose data goes: there is no way to name another account.
// Recordings live at ElevenLabs and a GitHub connection at Composio; both go first, while we still know their ids.
// An outage there must not block erasing everything here, so anything left behind is reported instead.
me.delete("/", async (c) => {
  const userId = c.var.sessionId;
  const recordingsLeft = await forgetUserRecordings(c.env, userId);
  const githubLeft = await disconnectGithub(c.env, userId).then(
    () => false,
    () => true,
  );
  const deleted = await eraseUserData(c.env, userId);
  return c.json({ deleted, ...(recordingsLeft > 0 ? { recordingsLeft } : {}), ...(githubLeft ? { githubLeft } : {}) });
});
