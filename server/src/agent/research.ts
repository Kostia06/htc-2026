import { Hono } from "hono";
import { generate, type GeminiContent } from "../ai/gemini";
import type { AppContext, Env } from "../env";
import { saveFact } from "../memory/facts";
import { memorySearch } from "../memory/search";
import { keenableFetch, keenableSearch } from "./keenable";
import { runAgent, type Declaration, type Model } from "./loop";
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

export async function researchCompany(env: Env, slug: string) {
  const company = await env.DB.prepare("SELECT id, name, website FROM companies WHERE slug = ?")
    .bind(slug)
    .first<{ id: string; name: string; website: string | null }>();
  if (!company) throw new Error(`unknown company ${slug}`);

  const tools = makeTools(deps.tools(env), company.id);
  const goal = `Research ${company.name}${company.website ? ` (${company.website})` : ""} for people applying to entry-level and junior roles in Calgary.`;
  const run = await runAgent({ model: deps.model(env), tools, goal, maxSteps: MAX_STEPS });

  await env.DB.prepare("UPDATE companies SET last_researched_at = ? WHERE id = ?").bind(new Date().toISOString(), company.id).run();
  const saves = run.toolCalls.filter((c) => c.name === "save_fact").length;
  return { added: saves, summary: run.answer, steps: run.toolCalls.length, stoppedEarly: run.stoppedEarly };
}

export async function researchTracked(env: Env) {
  const { results } = await env.DB.prepare("SELECT slug FROM companies WHERE tracked = 1").all<{ slug: string }>();
  for (const { slug } of results) {
    await researchCompany(env, slug).catch((e) => console.error("research failed", slug, (e as Error).message));
  }
}

export const research = new Hono<AppContext>();

research.post("/:slug", async (c) => {
  const row = await c.env.DB.prepare("SELECT last_researched_at FROM companies WHERE slug = ?")
    .bind(c.req.param("slug"))
    .first<{ last_researched_at: string | null }>();
  if (!row) return c.json({ error: "unknown company" }, 404);
  if (row.last_researched_at && Date.now() - Date.parse(row.last_researched_at) < COOLDOWN_MS) {
    return c.json({ error: "researched recently, try again later" }, 429);
  }
  return c.json(await researchCompany(c.env, c.req.param("slug")));
});
