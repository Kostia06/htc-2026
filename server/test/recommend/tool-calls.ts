import type { ToolCallRecord } from "../../src/agents/core/loop";
import { UNTRUSTED_NOTE, wrapUntrusted } from "../../src/agents/tools/untrusted";

export const fetched = (url: string, text: string): ToolCallRecord => ({
  name: "fetch_page",
  args: { url },
  result: { note: UNTRUSTED_NOTE, text: wrapUntrusted(text) },
});

export const profileCall = (result: unknown): ToolCallRecord => ({ name: "profile", args: {}, result });
