import type { Env } from "../env";
import { generate } from "../integrations/gemini";
import { keenableFetch, keenableSearch } from "../integrations/keenable";
import { saveFact } from "../memory/facts";
import { getCompanyInsights } from "../memory/insights";
import { memorySearch } from "../memory/search";
import { claimResearch, startResearch } from "./background";
import type { Model } from "./core/loop";
import { memoryFor } from "./core/memory-port";
import type { AgentDeps } from "./core/types";
import { USER_AGENT } from "./tools/fetch-page";

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

async function fetchRobots(origin: string) {
  const res = await fetch(`${origin}/robots.txt`, { headers: { "User-Agent": USER_AGENT } }).catch(() => null);
  return res?.ok ? res.text() : null;
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
      fetchRobots,
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
