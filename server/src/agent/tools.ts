import type { FactKind, NewFact } from "../memory/facts";
import { isAllowed, isBlockedHost } from "../lib/robots";
import type { Tool } from "./loop";

export const USER_AGENT = "HTCMentorBot/1.0 (+https://github.com/Kostia06/htc-2026)";
const PAGE_LIMIT = 8000;

export type SearchResult = { title: string; url: string; snippet: string };
export type MemoryHit = { kind: string; text: string; source_url?: string; score: number };

export type ToolDeps = {
  search: (query: string) => Promise<SearchResult[]>;
  fetchPage: (url: string) => Promise<string>;
  fetchRobots: (origin: string) => Promise<string | null>;
  memorySearch: (companyId: string, query: string) => Promise<MemoryHit[]>;
  saveFact: (companyId: string, fact: NewFact) => Promise<{ saved: boolean; reason?: string }>;
};

const KINDS: FactKind[] = ["about", "hiring", "interview", "tech", "news"];
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function makeTools(deps: ToolDeps, companyId: string): Record<string, Tool> {
  return {
    web_search: {
      declaration: {
        name: "web_search",
        description: "Search the public web. Returns titles, URLs and snippets.",
        parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
      },
      run: async (args) => {
        const results = await deps.search(str(args.query));
        return { results: results.filter((r) => !isBlockedHost(r.url)).slice(0, 8) };
      },
    },

    fetch_page: {
      declaration: {
        name: "fetch_page",
        description: "Read a public web page as text. Some sites are off limits and will be skipped.",
        parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
      },
      run: async (args) => {
        const url = str(args.url);
        if (isBlockedHost(url)) return { skipped: true, reason: "site not allowed" };
        const { origin, pathname } = new URL(url);
        const robots = (await deps.fetchRobots(origin)) ?? "";
        if (!isAllowed(robots, USER_AGENT, pathname)) return { skipped: true, reason: "robots.txt disallows" };
        try {
          return { text: (await deps.fetchPage(url)).slice(0, PAGE_LIMIT) };
        } catch (e) {
          return { skipped: true, reason: (e as Error).message };
        }
      },
    },

    memory_search: {
      declaration: {
        name: "memory_search",
        description: "Search what we already know about this company before researching more.",
        parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
      },
      run: async (args) => ({ hits: await deps.memorySearch(companyId, str(args.query)) }),
    },

    save_fact: {
      declaration: {
        name: "save_fact",
        description: "Save one new, specific fact about the company with the URL it came from.",
        parameters: {
          type: "object",
          properties: {
            kind: { type: "string", enum: KINDS },
            text: { type: "string" },
            source_url: { type: "string" },
          },
          required: ["kind", "text", "source_url"],
        },
      },
      run: async (args) => {
        const fact = { kind: str(args.kind) as FactKind, text: str(args.text), source_url: str(args.source_url) };
        if (!KINDS.includes(fact.kind) || !fact.text) return { saved: false, reason: "kind and text required" };
        if (!/^https?:\/\//.test(fact.source_url) || isBlockedHost(fact.source_url)) {
          return { saved: false, reason: "needs a public source_url" };
        }
        return deps.saveFact(companyId, fact);
      },
    },
  };
}
