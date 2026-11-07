import type { ToolDefinition } from "../core/types";
import { text } from "./args";
import { UNTRUSTED_NOTE } from "./untrusted";

const NOTE = `${UNTRUSTED_NOTE} These are Hacker News posts and comments from the last two years: personal accounts, so cite them as anecdotes with their link and author. To save a fact, read a page with fetch_page first (for example a story's link) and cite that page.`;

export const hnSearch: ToolDefinition = {
  name: "hn_search",
  description: "Search recent Hacker News stories and comments, e.g. \"<company> interview\" or \"<company> hiring process\".",
  parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  run: async (args, ctx) => {
    const query = text(args.query);
    if (!query) return { error: "a search query is required" };
    try {
      const hits = await ctx.services.hackerNews(query);
      return { note: NOTE, results: hits.map((hit) => ({ ...hit, label: "anecdote" as const })) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  },
};
