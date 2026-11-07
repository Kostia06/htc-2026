import type { ToolDefinition } from "../core/types";
import { NO_COMPANY, text } from "./args";

export const companyFacts: ToolDefinition = {
  name: "company_facts",
  description: "Search the facts already saved about this company. Check here before researching more.",
  parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  run: async (args, ctx) => {
    if (!ctx.company) return NO_COMPANY;
    return { facts: await ctx.services.companyFacts(ctx.company.id, text(args.query)) };
  },
};
