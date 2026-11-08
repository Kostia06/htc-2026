import { liveRobotsServices } from "../../agents/live";
import { robotsRefusal } from "../../agents/shared-tools/fetch-page";
import { keenableFetch, keenableSearch } from "../../integrations/keenable";
import { fetchBlockReason, searchResultUse } from "../../lib/source-policy";
import type { Env } from "../../env";
import { cached } from "../../memory/cache";
import type { ResearchPage } from "./types";

export type QuestionType = "behavioral" | "technical" | "motivation" | "general";

// how interviewers at a company think changes slowly, and every candidate for that role asks the same thing
const TTL_SECONDS = 7 * 86_400;
const PAGES_PER_LOOKUP = 2;
const RESULTS_LOOKED_AT = 5;
const EXCERPT_CHARS = 3000;

/** Keenable calls one session may still spend, whatever the questions turn out to be. */
export type Budget = { searchesLeft: number; fetchesLeft: number };
export const sessionBudget = (): Budget => ({ searchesLeft: 4, fetchesLeft: 3 });

export const researchDeps = {
  search: (env: Env, query: string) => keenableSearch(env, query),
  fetchPage: (env: Env, url: string) => keenableFetch(env, url),
  refusal: (env: Env, url: string) => robotsRefusal(url, liveRobotsServices(env)),
};

export function questionType(question: string): QuestionType {
  const q = question.toLowerCase();
  if (/\bwhy (us|our|this|here|do you want|are you interested)|interest(ed)? in (us|this|the role)/.test(q)) return "motivation";
  if (/tell me about a time|describe a (time|situation)|an example of|conflict|disagree|mistake|fail|challenge/.test(q)) return "behavioral";
  if (/\b(sql|code|coding|algorithm|debug|design a|system|query|api|data model|technical)\b/.test(q)) return "technical";
  return "general";
}

function queriesFor(company: string, role: string, type: QuestionType): string[] {
  const values = `${company} values culture what they look for in candidates`;
  const byType: Record<QuestionType, string> = {
    behavioral: `${company} ${role} behavioral interview what interviewers look for`,
    technical: `${company} ${role} technical interview process`,
    motivation: `${company} mission why work here`,
    general: `${company} ${role} interview process`,
  };
  return [byType[type], values];
}

const key = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

// the same bar every agent page read passes: our deny list, a robots.txt that lets everyone in, and the crawl-delay
async function mayRead(env: Env, url: string) {
  if (fetchBlockReason(url) || searchResultUse(url) !== "link") return false;
  return (await researchDeps.refusal(env, url)) === null;
}

async function readPage(env: Env, result: { title: string; url: string }, budget: Budget): Promise<ResearchPage | null> {
  if (budget.fetchesLeft <= 0 || !(await mayRead(env, result.url))) return null;
  budget.fetchesLeft--;
  const text = await researchDeps.fetchPage(env, result.url).catch(() => "");
  const excerpt = text.replace(/\s+/g, " ").trim().slice(0, EXCERPT_CHARS);
  return excerpt ? { title: result.title || new URL(result.url).hostname, url: result.url, excerpt } : null;
}

async function lookup(env: Env, company: string, role: string, type: QuestionType, budget: Budget): Promise<ResearchPage[]> {
  const pages: ResearchPage[] = [];
  const seen = new Set<string>();
  for (const query of queriesFor(company, role, type)) {
    if (pages.length >= PAGES_PER_LOOKUP || budget.searchesLeft <= 0) break;
    budget.searchesLeft--;
    const results = await researchDeps.search(env, query).catch(() => []);
    for (const result of results.slice(0, RESULTS_LOOKED_AT)) {
      if (pages.length >= PAGES_PER_LOOKUP || seen.has(result.url)) continue;
      seen.add(result.url);
      const page = await readPage(env, result, budget);
      if (page) pages.push(page);
    }
  }
  // thrown so the cache keeps nothing: a miss today (search down, every page refused) shouldn't stick for a week
  if (pages.length === 0) throw new Error("no readable pages");
  return pages;
}

/** Public pages on how this company interviews for this kind of question. Cached, so a repeat costs nothing. */
export async function researchFor(env: Env, company: { slug: string; name: string }, role: string, type: QuestionType, budget: Budget) {
  const cacheKey = `interview-research:${key(company.slug)}:${key(role)}:${type}`;
  try {
    return await cached(env, cacheKey, TTL_SECONDS, () => lookup(env, company.name, role, type, budget));
  } catch {
    return [];
  }
}
