import { generate, type GeminiContent } from "../../integrations/gemini";
import type { Env } from "../../env";
import { saveFact } from "../../memory/facts";
import { memorySearch } from "../../memory/search";
import { keenableFetch, keenableSearch } from "../../integrations/keenable";
import { runAgent, type Declaration, type Model } from "../core/loop";
import { makeTools, USER_AGENT, type ToolDeps } from "./tools";

const MAX_STEPS = 12;
const COOLDOWN_MS = 30 * 60_000;

const SYSTEM = `You research employers for a career mentoring app used by students and job seekers in Calgary.
Find current, specific facts that help someone prepare to apply and interview: hiring plans, interview process and rounds,
tech stack and tools, values and culture, recent news. Always check memory_search first and skip what is already known.
Use web_search, then fetch_page on the most useful official or reputable pages. Save each new fact with save_fact,
one fact per call, one or two sentences, with the exact page URL as source_url. Never invent facts or URLs.
Some sites are off limits; if a page is skipped, move on. Stop when you have saved the useful new facts, then reply with a one-line summary.`;

function geminiModel(env: Env): Model {
  return (contents: GeminiContent[], declarations: Declaration[]) =>
    generate(env, {
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents,
      tools: [{ functionDeclarations: declarations }],
    });
}

function liveTools(env: Env): ToolDeps {
  return {
    search: (q) => keenableSearch(env, q),
    fetchPage: (url) => keenableFetch(env, url),
    fetchRobots: async (origin) => {
      const res = await fetch(`${origin}/robots.txt`, { headers: { "User-Agent": USER_AGENT } }).catch(() => null);
      return res?.ok ? res.text() : null;
    },
    memorySearch: (companyId, q) => memorySearch(env, companyId, q),
    saveFact: (companyId, fact) => saveFact(env, companyId, fact),
  };
}

export const deps = { model: geminiModel, tools: liveTools };

// atomic: two requests racing for the same company can't both get through the cooldown
export async function claimResearch(env: Env, slug: string) {
  const now = new Date();
  const row = await env.DB.prepare(
    "UPDATE companies SET last_researched_at = ? WHERE slug = ? AND (last_researched_at IS NULL OR last_researched_at < ?) RETURNING id",
  )
    .bind(now.toISOString(), slug, new Date(now.getTime() - COOLDOWN_MS).toISOString())
    .first<{ id: string }>();
  return row !== null;
}

export async function researchCompany(env: Env, slug: string) {
  const company = await env.DB.prepare("SELECT id, name, website FROM companies WHERE slug = ?")
    .bind(slug)
    .first<{ id: string; name: string; website: string | null }>();
  if (!company) throw new Error(`unknown company ${slug}`);

  const tools = makeTools(deps.tools(env), company.id);
  const goal = `Research ${company.name}${company.website ? ` (${company.website})` : ""} for people applying to entry-level and junior roles in Calgary.`;
  const run = await runAgent({ model: deps.model(env), tools, goal, maxSteps: MAX_STEPS });

  const added = run.toolCalls.filter((c) => c.name === "save_fact" && (c.result as { saved?: boolean })?.saved).length;
  return { added, summary: run.answer, toolCalls: run.toolCalls.length, stoppedEarly: run.stoppedEarly };
}

export async function researchTracked(env: Env) {
  const { results } = await env.DB.prepare("SELECT slug FROM companies WHERE tracked = 1").all<{ slug: string }>();
  for (const { slug } of results) {
    if (!(await claimResearch(env, slug))) continue;
    await researchCompany(env, slug).catch((e) => console.error("research failed", slug, (e as Error).message));
  }
}
