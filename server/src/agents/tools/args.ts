import type { ToolContext } from "../core/types";

export const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export const NO_COMPANY = { error: "this run has no company; pass a company slug" };

// tools that accept a `company` slug fall back to the company the run is about
export const companySlug = (args: Record<string, unknown>, ctx: ToolContext) => text(args.company) || ctx.company?.slug || "";
