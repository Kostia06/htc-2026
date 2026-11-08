import { Hono } from "hono";
import { MAX_ROLE, recordOutcome } from "../crossroads/outcome";
import { db } from "../db";
import type { AppContext } from "../env";

export const outcome = new Hono<AppContext>();

/** POST /api/me/outcome {role, company?, share}: "I got the job". With share, the road that got them there helps the next person. */
outcome.post("/", async (c) => {
  const body = await c.req.json<{ role?: unknown; company?: unknown; share?: unknown }>().catch(() => null);
  if (!body || typeof body.role !== "string" || !body.role.trim() || body.role.length > MAX_ROLE) {
    return c.json({ error: `send the role you got, under ${MAX_ROLE} characters` }, 400);
  }
  if (body.share !== undefined && typeof body.share !== "boolean") return c.json({ error: "share must be true or false" }, 400);
  if (body.company !== undefined && typeof body.company !== "string") return c.json({ error: "company must be a company slug" }, 400);

  // only a company Skillit knows is kept, so free text can never ride along in that field
  const known = body.company ? await db(c.env).prepare("SELECT slug FROM companies WHERE slug = ?").bind(body.company).first<{ slug: string }>() : null;
  const result = await recordOutcome(c.env, c.var.sessionId, { role: body.role, companySlug: known?.slug, share: body.share === true });
  return c.json(result, 201);
});
