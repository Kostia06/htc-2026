import { isBlockedHost } from "../../lib/robots";
import type { ToolDefinition } from "../core/types";
import { text } from "./args";
import { UNTRUSTED_NOTE } from "./untrusted";

const MAX_RESULTS = 8;

export const webSearch: ToolDefinition = {
  name: "web_search",
  description: "Search the public web. Returns titles, URLs and snippets.",
  parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  run: async (args, ctx) => {
    const results = await ctx.services.search(text(args.query));
    return { note: UNTRUSTED_NOTE, results: results.filter((r) => !isBlockedHost(r.url)).slice(0, MAX_RESULTS) };
  },
};
