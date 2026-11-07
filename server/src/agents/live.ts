import type { Env } from "../env";
import { adzunaSearch } from "../integrations/adzuna";
import { devtoArticles } from "../integrations/devto";
import { generate } from "../integrations/gemini";
import { hackerNewsSearch } from "../integrations/hacker-news";
import { keenableFetch, keenableSearch } from "../integrations/keenable";
import { fetchRobotsTxt } from "../integrations/robots-txt";
import { USER_AGENT } from "../lib/user-agent";
import { cached } from "../memory/cache";
import { claimCooldown } from "../memory/cooldowns";
import { saveFact } from "../memory/facts";
import { claimFetchSlot } from "../memory/host-fetches";
import { getCompanyInsights } from "../memory/insights";
import { memorySearch } from "../memory/search";
import { claimResearch, startResearch } from "./background";
import type { Model } from "./core/loop";
import { memoryFor } from "./core/memory-port";
import type { AgentDeps } from "./core/types";

const ROBOTS_TTL_SECONDS = 6 * 3600;

// mode ANY makes Gemini answer with a tool call every turn, so a run can only end through finish or the step limit
function geminiModel(env: Env, systemPrompt: string): Model {
  return (contents, declarations) =>
    generate(env, {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      tools: [{ functionDeclarations: declarations }],
      toolConfig: { functionCallingConfig: { mode: "ANY" } },
    });
}

// waitUntil keeps the Worker alive for research queued during a request
export function liveDeps(env: Env, waitUntil: (work: Promise<unknown>) => void): AgentDeps {
  const deps: AgentDeps = {
    env,
    model: (systemPrompt) => geminiModel(env, systemPrompt),
    memoryFor: (userId) => memoryFor(env, userId),
    services: {
      search: (query) => keenableSearch(env, query),
      fetchPage: (url) => keenableFetch(env, url),
      fetchRobots: (origin) => cached(env, `robots:${origin}`, ROBOTS_TTL_SECONDS, () => fetchRobotsTxt(origin, USER_AGENT)),
      claimFetchSlot: (host, delaySeconds) => claimFetchSlot(env, host, delaySeconds),
      claimCooldown: (scope, key, cooldownMs) => claimCooldown(env, scope, key, cooldownMs),
      jobPostings: (query) => adzunaSearch(env, query),
      hackerNews: (query) => hackerNewsSearch(query),
      devtoArticles: (tag) => devtoArticles(tag),
      companyFacts: (companyId, query) => memorySearch(env, companyId, query),
      saveFact: (companyId, fact) => saveFact(env, companyId, fact),
      companyInsights: (slug, role) => getCompanyInsights(env, slug, role),
      claimResearch: (slug) => claimResearch(env, slug),
      startResearch: async (slug) => {
        const started = await startResearch(deps, slug);
        if (started) waitUntil(started.result);
        return started !== null;
      },
    },
  };
  return deps;
}
