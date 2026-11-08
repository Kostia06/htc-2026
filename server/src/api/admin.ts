import { Hono } from "hono";
import type { AppContext } from "../env";
import { reembedVectors } from "../memory/reembed";

const DEFAULT_PAGE = 100;

// operator-only, behind ADMIN_SECRET rather than a session; without the secret the route does not exist
export const admin = new Hono<AppContext>();

admin.use("*", async (c, next) => {
  const secret = c.env.ADMIN_SECRET;
  if (!secret) return c.notFound();
  const header = c.req.header("Authorization") ?? "";
  if (header !== `Bearer ${secret}`) return c.json({ error: "unauthorized" }, 401);
  return next();
});

// POST /admin/reembed-vectors?offset=0&limit=100 → { embedded, next }; call again with next until it is null
admin.post("/reembed-vectors", async (c) => {
  const offset = Math.max(0, Number(c.req.query("offset")) || 0);
  const limit = Math.min(500, Math.max(1, Number(c.req.query("limit")) || DEFAULT_PAGE));
  return c.json(await reembedVectors(c.env, { offset, limit }));
});
