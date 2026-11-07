import { FACT_KINDS as KINDS, type FactKind } from "../../memory/facts";
import type { ToolDefinition } from "../core/types";
import { text } from "./args";
import { pageKey } from "./fetch-page";

const MAX_LENGTH = 500;

export const saveFact: ToolDefinition = {
  name: "save_fact",
  description: "Save one new, specific fact about the company. source_url must be a page you read with fetch_page in this run.",
  parameters: {
    type: "object",
    properties: { kind: { type: "string", enum: KINDS }, text: { type: "string" }, source_url: { type: "string" } },
    required: ["kind", "text", "source_url"],
  },
  run: async (args, ctx) => {
    if (!ctx.company) return { saved: false, reason: "this run has no company" };
    const fact = { kind: text(args.kind) as FactKind, text: text(args.text).slice(0, MAX_LENGTH), source_url: text(args.source_url) };
    if (!KINDS.includes(fact.kind) || !fact.text) return { saved: false, reason: "kind and text required" };
    if (!ctx.fetchedPages.has(pageKey(fact.source_url))) {
      return { saved: false, reason: "source_url must be a page you successfully read with fetch_page in this run" };
    }
    return ctx.services.saveFact(ctx.company.id, fact);
  },
};
