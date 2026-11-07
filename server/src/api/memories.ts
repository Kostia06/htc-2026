import { Hono } from "hono";
import type { AppContext } from "../env";
import { forget, listMemories } from "../memory/private/store";
import { type ShareRefusal, shareMemory } from "../memory/share";

const REFUSALS: Record<ShareRefusal, { status: 400 | 404 | 429; error: string }> = {
  not_found: { status: 404, error: "memory not found" },
  not_a_note: { status: 400, error: "only notes can be shared" },
  invalid: { status: 400, error: "the note or role is too long to share" },
  unknown_company: { status: 404, error: "unknown company" },
  rate_limited: { status: 429, error: "too many submissions, try again later" },
};

const isFilledText = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

export const memories = new Hono<AppContext>();

memories.get("/", async (c) => {
  return c.json({ memories: await listMemories(c.env, c.var.sessionId) });
});

memories.delete("/:id", async (c) => {
  const deleted = await forget(c.env, c.var.sessionId, c.req.param("id"));
  return deleted ? c.body(null, 204) : c.json({ error: "memory not found" }, 404);
});

memories.post("/:id/share", async (c) => {
  const body = await c.req.json<{ companySlug?: unknown; role?: unknown }>().catch(() => null);
  if (!body || !isFilledText(body.companySlug) || !isFilledText(body.role)) {
    return c.json({ error: "send a companySlug and a role" }, 400);
  }

  const result = await shareMemory(c.env, c.var.sessionId, c.req.param("id"), { companySlug: body.companySlug, role: body.role });
  if (result.shared) return c.json({ ok: true }, 201);
  const refusal = REFUSALS[result.reason];
  return c.json({ error: refusal.error }, refusal.status);
});
