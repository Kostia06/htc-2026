import { MEMORY_KINDS, type MemoryKind, type ToolDefinition } from "../core/types";
import { text } from "./args";

const MAX_ITEMS = 10;

export const recall: ToolDefinition = {
  name: "recall",
  description: "Read what you remember about this person: goals, skills, weak spots, preferences and notes.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "what to look for; leave out for the most relevant items" },
      kinds: { type: "array", items: { type: "string", enum: [...MEMORY_KINDS] } },
      limit: { type: "integer" },
    },
  },
  run: async (args, ctx) => {
    const kinds = Array.isArray(args.kinds) ? args.kinds.filter((k): k is MemoryKind => MEMORY_KINDS.includes(k)) : undefined;
    const limit = Math.min(Number(args.limit) || MAX_ITEMS, MAX_ITEMS);
    const memories = await ctx.memory.recall({ query: text(args.query) || undefined, kinds, limit });
    return { memories: memories.map(({ kind, text }) => ({ kind, text })) };
  },
};
