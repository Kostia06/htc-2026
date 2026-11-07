import type { Env } from "../env";
import { RunRejected, startSkill } from "./core/harness";
import type { AgentDeps, RunResult } from "./core/types";
import { researchCompany as researchCompanySkill } from "./research/skills/research-company";

// background runs act for nobody in particular; this id never matches a real session
const BACKGROUND_USER = "background";
const COOLDOWN_MS = 30 * 60_000;

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

// null while the company is on cooldown; otherwise the run is recorded and still going
export async function startResearch(deps: AgentDeps, slug: string) {
  const request = { skill: researchCompanySkill, platform: "background" as const, userId: BACKGROUND_USER, input: { company: slug } };
  try {
    return await startSkill(deps, request);
  } catch (e) {
    if (e instanceof RunRejected && e.status === 429) return null;
    throw e;
  }
}

function summarise(result: RunResult) {
  const added = result.toolCalls.filter((c) => c.name === "save_fact" && (c.result as { saved?: boolean }).saved).length;
  const summary = result.status === "done" ? String(result.output.summary) : "";
  return { runId: result.runId, status: result.status, added, summary, toolCalls: result.toolCalls.length };
}

export async function runResearch(deps: AgentDeps, slug: string) {
  const started = await startResearch(deps, slug);
  return started ? summarise(await started.result) : null;
}

export async function researchTracked(deps: AgentDeps) {
  const { results } = await deps.env.DB.prepare("SELECT slug FROM companies WHERE tracked = 1").all<{ slug: string }>();
  for (const { slug } of results) {
    await runResearch(deps, slug).catch((e) => console.error("research failed", slug, (e as Error).message));
  }
}
