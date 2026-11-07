import { Hono } from "hono";
import type { AppContext } from "../env";
import { isEmptyPatch, parsePatch } from "../memory/profile/patch";
import { deleteProfile, getProfile, updateProfile } from "../memory/profile/store";

export const profile = new Hono<AppContext>();

profile.get("/", async (c) => c.json({ profile: await getProfile(c.env, c.var.sessionId) }));

// for the onboarding form: structured answers go straight in; free text goes through the profile-intake skill instead
profile.patch("/", async (c) => {
  const patch = parsePatch(await c.req.json().catch(() => null));
  if (!patch || isEmptyPatch(patch)) return c.json({ error: "send profile fields to update" }, 400);
  return c.json({ profile: await updateProfile(c.env, c.var.sessionId, patch) });
});

profile.delete("/", async (c) => {
  await deleteProfile(c.env, c.var.sessionId);
  return c.body(null, 204);
});
