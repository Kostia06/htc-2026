import { Hono } from "hono";
import type { AppContext } from "../env";
import { getCompanyInsights } from "../memory/insights";

export const memory = new Hono<AppContext>();

memory.get("/:slug", async (c) => {
  const insights = await getCompanyInsights(c.env, c.req.param("slug"), c.req.query("role"));
  return insights ? c.json(insights) : c.json({ error: "unknown company" }, 404);
});
