import type { ToolCallRecord } from "../core/loop";
import type { Skill, SkillOutput } from "../core/types";

export const INTEL_COOLDOWN_MS = 24 * 3600_000;
const MAX_LINKS = 8;

type IntelInput = { company: string; role?: string };
type Labelled = { url: string; label?: string };

const resultsOf = (call: ToolCallRecord) => (call.result as { results?: Labelled[] }).results ?? [];
const savedFacts = (toolCalls: ToolCallRecord[]) =>
  toolCalls.filter((c) => c.name === "save_fact" && (c.result as { saved?: boolean }).saved);

// links only: anecdote text came from search snippets and is never kept
function anecdoteLinks(toolCalls: ToolCallRecord[]) {
  const urls = toolCalls.flatMap((c) => resultsOf(c).filter((r) => r.label === "anecdote").map((r) => r.url));
  return [...new Set(urls)].slice(0, MAX_LINKS);
}

export const interviewIntel: Skill<IntelInput> = {
  name: "interview-intel",
  description: "Gather recent public information on how one company interviews, and save what pages confirm as interview_process facts.",
  platforms: ["background"],
  // facts are shared by everyone, so nothing private may shape them
  personal: false,
  tools: ["company_facts", "hn_search", "devto_search", "web_search", "fetch_page", "save_fact"],
  maxSteps: 12,
  instructions: `Find out how one employer interviews today: stages and rounds, formats (phone screen, take-home, live coding,
system design, behavioural, panel), typical questions, timelines. Prefer what is recent.
1. Call company_facts for "interview process" and skip anything already known.
2. Look for leads: hn_search with the company name and "interview" or "hiring"; devto_search with the company name as keyword;
   web_search for the company's own "how we hire" or careers pages and engineering blog posts about interviewing.
3. Read the most useful pages with fetch_page: the company's own pages first, then a story's link or a dev.to article.
   If a page is skipped, move on; never retry it.
4. Save each new, specific point a page you read states with save_fact, kind interview_process, one point per call,
   one or two sentences, with that page's exact URL as source_url.
   Search snippets, Hacker News comments and results labelled "anecdote" are not facts: never save them.
   You may mention a pattern several anecdotes share in the summary, as "some candidates report ...".
5. Call finish with a short summary of the process and "stages", the interview stages in order as short labels.`,
  inputSchema: {
    type: "object",
    properties: {
      company: { type: "string", description: "company slug", maxLength: 100 },
      role: { type: "string", maxLength: 100 },
    },
    required: ["company"],
  },
  outputSchema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "a few sentences on the interview process" },
      stages: { type: "array", maxItems: 8, items: { type: "string" } },
    },
    required: ["summary", "stages"],
  },
  // its own cooldown, so it never blocks or waits on research-company
  claim: (input, services) => services.claimCooldown("interview-intel", input.company, INTEL_COOLDOWN_MS),
  buildGoal: (input, { company }) => {
    if (!company) throw new Error("interview intel needs a company");
    const role = input.role ? ` for the ${input.role} role` : "";
    return `Find out how ${company.name}${company.website ? ` (${company.website})` : ""} interviews${role}.`;
  },
  // counted from what the tools did, not from the model's word
  finalize: (output, toolCalls): SkillOutput => {
    const saved = savedFacts(toolCalls);
    return {
      ...output,
      factsSaved: saved.length,
      sources: [...new Set(saved.map((c) => String(c.args.source_url)))],
      anecdotes: anecdoteLinks(toolCalls),
    };
  },
};
