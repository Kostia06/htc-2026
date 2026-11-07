import { Hono } from "hono";
import { runResearch } from "../agents/background";
import { liveDeps } from "../agents/live";
import type { AppContext } from "../env";

export const research = new Hono<AppContext>();

research.post("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const exists = await c.env.DB.prepare("SELECT 1 FROM companies WHERE slug = ?").bind(slug).first();
  if (!exists) return c.json({ error: "unknown company" }, 404);
  const deps = liveDeps(c.env, (work) => c.executionCtx.waitUntil(work));
  const out = await runResearch(deps, slug);
  return out ? c.json(out) : c.json({ error: "researched recently, try again later" }, 429);
});
