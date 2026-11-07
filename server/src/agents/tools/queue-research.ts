import type { ToolDefinition } from "../core/types";
import { companySlug, NO_COMPANY } from "./args";

export const queueResearch: ToolDefinition = {
  name: "queue_research",
  description:
    "Ask for fresh background research on a company when what we know looks thin or old. Returns at once; results arrive later, not in this run.",
  parameters: {
    type: "object",
    properties: { company: { type: "string", description: "company slug; leave out for this run's company" } },
  },
  run: async (args, ctx) => {
    const slug = companySlug(args, ctx);
    if (!slug) return NO_COMPANY;
    if (!(await ctx.services.startResearch(slug))) return { queued: false, reason: "researched recently" };
    return { queued: true };
  },
};
