import type { Skill } from "../core/types";

export const researchCompany: Skill<{ company: string }> = {
  name: "research-company",
  description: "Find and save current public facts about one employer.",
  platforms: ["background"],
  // facts are shared by everyone, so nothing private may shape them
  personal: false,
  tools: ["company_facts", "web_search", "fetch_page", "save_fact"],
  maxSteps: 12,
  instructions: `Research one employer for people applying to entry-level and junior roles in Calgary.
Find current, specific facts that help someone apply and interview: hiring plans, interview process and rounds,
tech stack and tools, values and culture, recent news.
1. Call company_facts first and skip anything already known.
2. Use web_search, then fetch_page on the most useful official or reputable pages. If a page is skipped, move on.
3. Save each new fact with save_fact: one fact per call, one or two sentences, with the exact page URL as source_url.
4. When the useful new facts are saved, call finish with a one-line summary of what you added.`,
  inputSchema: {
    type: "object",
    properties: { company: { type: "string", description: "company slug", maxLength: 100 } },
    required: ["company"],
  },
  outputSchema: {
    type: "object",
    properties: { summary: { type: "string", description: "one line: what was added" } },
    required: ["summary"],
  },
  // the 30-minute cooldown, whichever way the run was started
  claim: (input, services) => services.claimResearch(input.company),
  buildGoal: (_input, { company }) => {
    if (!company) throw new Error("research needs a company");
    return `Research ${company.name}${company.website ? ` (${company.website})` : ""}.`;
  },
};
