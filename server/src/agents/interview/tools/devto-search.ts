import type { ToolDefinition } from "../../core/types";
import { text } from "../../shared-tools/args";
import { UNTRUSTED_NOTE } from "../../shared-tools/untrusted";

const DEFAULT_TAG = "interview";
const MAX_RESULTS = 8;

const NOTE = `${UNTRUSTED_NOTE} dev.to articles are written by their authors; credit the author and link the article. To save a fact, read the article with fetch_page first.`;

const mentions = (haystack: string[], keyword: string) => haystack.some((s) => s.toLowerCase().includes(keyword));

export const devtoSearch: ToolDefinition = {
  name: "devto_search",
  description: "List this year's top dev.to articles for a tag (default interview), optionally only those mentioning a keyword such as a company name.",
  parameters: {
    type: "object",
    properties: {
      tag: { type: "string", description: `one dev.to tag; defaults to ${DEFAULT_TAG}` },
      keyword: { type: "string", description: "keep only articles whose title, description or tags mention this" },
    },
  },
  run: async (args, ctx) => {
    const tag = text(args.tag).toLowerCase().replace(/[^a-z0-9]/g, "") || DEFAULT_TAG;
    const keyword = text(args.keyword).toLowerCase();
    try {
      const articles = await ctx.services.devtoArticles(tag);
      const matching = keyword ? articles.filter((a) => mentions([a.title, a.description, ...a.tags], keyword)) : articles;
      return { note: NOTE, results: matching.slice(0, MAX_RESULTS) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  },
};
