import type { ToolDefinition } from "../core/types";
import { text } from "./args";
import { UNTRUSTED_NOTE } from "./untrusted";

const DEFAULT_WHERE = "Calgary";

const NOTE = `${UNTRUSTED_NOTE} Descriptions are Adzuna's 500-character previews; the full posting is behind the link and is never fetched. Salary and contract fields are often missing. Show each listing with its attribution and link.`;

export const jobPostings: ToolDefinition = {
  name: "job_postings",
  description: "Search current job listings (from Adzuna) by role or keywords. Each listing has a short description and a link.",
  parameters: {
    type: "object",
    properties: {
      what: { type: "string", description: "role or keywords, e.g. junior software developer" },
      where: { type: "string", description: `city or region; defaults to ${DEFAULT_WHERE}` },
    },
    required: ["what"],
  },
  run: async (args, ctx) => {
    const what = text(args.what);
    if (!what) return { error: "say what role or keywords to search for" };
    try {
      const postings = await ctx.services.jobPostings({ what, where: text(args.where) || DEFAULT_WHERE });
      return { note: NOTE, postings };
    } catch (e) {
      return { error: (e as Error).message };
    }
  },
};
