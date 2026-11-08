import { searchResultUse } from "../../lib/source-policy";
import type { SearchResult, ToolDefinition } from "../core/types";
import { text } from "./args";
import { UNTRUSTED_NOTE } from "./untrusted";

const MAX_RESULTS = 8;
const ANECDOTE_SNIPPET = 300;

const NOTE = `${UNTRUSTED_NOTE} Results labelled "anecdote" are one person's account from a public Reddit thread: cite them with their link as anecdotes, never save them as facts, and don't try to fetch them.`;

function asAnecdote(result: SearchResult) {
  return { ...result, snippet: result.snippet.slice(0, ANECDOTE_SNIPPET), label: "anecdote" as const };
}

export const webSearch: ToolDefinition = {
  name: "web_search",
  description: "Search the public web. Returns titles, URLs and snippets.",
  parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  run: async (args, ctx) => {
    const results = await ctx.services.search(text(args.query));
    const usable = results.flatMap((r) => {
      const use = searchResultUse(r.url);
      if (use === "drop") return [];
      return [use === "anecdote" ? asAnecdote(r) : r];
    });
    return { note: NOTE, results: usable.slice(0, MAX_RESULTS) };
  },
};
