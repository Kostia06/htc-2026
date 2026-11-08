import { db } from "../../db";
import type { AgentDeps } from "../core/types";

// half of the 14 days after which garbage collection deletes a fact, so research lands before facts disappear
export const FACTS_FRESH_DAYS = 7;
const DAY_MS = 86_400_000;

// the skills that should find recent facts about their company; research-company has no entry, so handoffs never chain
const RESEARCH_FIRST = new Set(["interview-prep", "interview-intel"]);

async function factsAreFresh(deps: AgentDeps, slug: string) {
  const row = await db(deps.env).prepare(
    "SELECT max(f.fetched_at) AS latest FROM companies c JOIN company_facts f ON f.company_id = c.id WHERE c.slug = ?",
  )
    .bind(slug)
    .first<{ latest: string | null }>();
  const cutoff = new Date(Date.now() - FACTS_FRESH_DAYS * DAY_MS).toISOString();
  return row?.latest != null && row.latest >= cutoff;
}

// runs alongside the user's skill: startResearch only records the run, the research itself continues in the background,
// and the research cooldown means a company is researched at most once per 30 minutes however many requests ask
export async function handOff(deps: AgentDeps, skillId: string, input: unknown) {
  const slug = (input as { company?: unknown }).company;
  if (!RESEARCH_FIRST.has(skillId) || typeof slug !== "string") return;
  try {
    if (!(await factsAreFresh(deps, slug))) await deps.services.startResearch(slug);
  } catch (e) {
    console.error("research handoff failed", slug, (e as Error).message);
  }
}
