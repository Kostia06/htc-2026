import type { ToolDefinition } from "../core/types";
import { companySlug, NO_COMPANY, text } from "./args";

const MAX_FACTS = 10;
const MAX_QUESTIONS = 15;

export const companyInsights: ToolDefinition = {
  name: "company_insights",
  description:
    "What everyone knows about a company: saved facts and interview questions people reported (example: true marks a common example question, not a real report). Defaults to this run's company.",
  parameters: {
    type: "object",
    properties: {
      company: { type: "string", description: "company slug; leave out for this run's company" },
      role: { type: "string", description: "only questions reported for this role" },
    },
  },
  run: async (args, ctx) => {
    const slug = companySlug(args, ctx);
    if (!slug) return NO_COMPANY;
    const insights = await ctx.services.companyInsights(slug, text(args.role) || undefined);
    if (!insights) return { error: `unknown company ${slug}` };
    return {
      company: insights.company.name,
      reportCount: insights.reportCount,
      facts: insights.facts.slice(0, MAX_FACTS).map(({ kind, text, source_url }) => ({ kind, text, source_url })),
      questions: insights.questions.slice(0, MAX_QUESTIONS),
    };
  },
};
