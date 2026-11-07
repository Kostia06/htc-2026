import type { ToolCallRecord } from "../agents/core/loop";
import { pageKey } from "../agents/shared-tools/fetch-page";

// the text of every page fetch_page actually returned in this run, keyed so URL spelling differences still match
export function fetchedPages(toolCalls: ToolCallRecord[]) {
  const pages = new Map<string, string>();
  for (const call of toolCalls.filter((c) => c.name === "fetch_page")) {
    const text = (call.result as { text?: unknown } | null)?.text;
    if (typeof text === "string" && typeof call.args.url === "string") pages.set(pageKey(call.args.url), text);
  }
  return pages;
}

export const pageText = (pages: Map<string, string>, url: string) => pages.get(pageKey(url));
