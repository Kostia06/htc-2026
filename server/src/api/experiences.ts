import { Hono } from "hono";
import type { AppContext } from "../env";
import { submitExperience } from "../memory/experiences";

export { deps } from "../memory/experiences";

export const experiences = new Hono<AppContext>();

experiences.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const result = await submitExperience(c.env, c.var.sessionId, body);
  return c.json(result.body, result.status);
});
