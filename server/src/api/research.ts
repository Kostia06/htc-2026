import { Hono } from "hono";
import { claimResearch, researchCompany } from "../agents/research/agent";
import type { AppContext } from "../env";

export const research = new Hono<AppContext>();

research.post("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const exists = await c.env.DB.prepare("SELECT 1 FROM companies WHERE slug = ?").bind(slug).first();
  if (!exists) return c.json({ error: "unknown company" }, 404);
  if (!(await claimResearch(c.env, slug))) return c.json({ error: "researched recently, try again later" }, 429);
  return c.json(await researchCompany(c.env, slug));
});
