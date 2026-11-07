import { MEMORY_KINDS, type MemoryKind, type ToolDefinition } from "../core/types";
import { text } from "./args";

const MAX_LENGTH = 300;

export const remember: ToolDefinition = {
  name: "remember",
  description: "Save one short thing worth remembering about this person, in your own words. Only this person can ever see it.",
  parameters: {
    type: "object",
    properties: { kind: { type: "string", enum: [...MEMORY_KINDS] }, text: { type: "string" } },
    required: ["kind", "text"],
  },
  run: async (args, ctx) => {
    const kind = text(args.kind) as MemoryKind;
    const content = text(args.text).slice(0, MAX_LENGTH);
    if (!MEMORY_KINDS.includes(kind) || !content) return { saved: false, reason: "a known kind and some text are required" };
    const saved = await ctx.memory.remember({ kind, text: content });
    return { saved: true, id: saved.id };
  },
};
