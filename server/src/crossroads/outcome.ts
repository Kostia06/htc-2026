import { db } from "../db";
import type { Env } from "../env";
import { anonymize } from "../lib/anonymize";
import { remember } from "../memory/private/store";
import { getProfile } from "../memory/profile/store";
import { loadAll } from "../roadmap/store";
import type { StepKind } from "../roadmap/types";
import { laneOf, roleKey } from "./lanes";

const MAX_STEPS = 20;
const MAX_SKILLS = 12;
export const MAX_ROLE = 80;

export type Outcome = { role: string; companySlug?: string; share: boolean };
export type OutcomeResult = { shared: boolean; steps: StepKind[]; skills: string[] };

// Crossroads itself is not a step anyone needs to copy to get the job
const isRoadStep = (kind: StepKind) => kind !== "explore_memory";

/**
 * "I got the job." Always kept privately, as the person's own note. With `share`, the road that got them there goes
 * to everyone as step kinds and skill names only: no step text, no notes, no dates.
 */
export async function recordOutcome(env: Env, userId: string, outcome: Outcome): Promise<OutcomeResult> {
  const role = anonymize(outcome.role.trim()).slice(0, MAX_ROLE);
  await remember(env, userId, { kind: "note", text: `Got the job: ${role}${outcome.companySlug ? ` at ${outcome.companySlug}` : ""}` });

  // in the order they were taken; steps finished in the same instant keep their order on the road
  const completed = (await loadAll(env, userId)).filter((s) => s.status === "done").sort((a, b) => (a.completedAt ?? "").localeCompare(b.completedAt ?? ""));
  const steps = completed.map((s) => s.kind).filter(isRoadStep).slice(0, MAX_STEPS);
  const profile = await getProfile(env, userId);
  const skills = [...new Set(profile.skills.map((s) => s.name.trim().toLowerCase()).filter(Boolean))].slice(0, MAX_SKILLS);
  if (!outcome.share) return { shared: false, steps, skills };

  await db(env).prepare(
    `INSERT INTO path_outcomes (id, user_id, lane, role, company_slug, steps_json, skills_json, is_seeded) VALUES (?, ?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT (user_id, role) DO UPDATE SET lane = excluded.lane, company_slug = excluded.company_slug, steps_json = excluded.steps_json, skills_json = excluded.skills_json`,
  )
    .bind(`po_${crypto.randomUUID()}`, userId, laneOf(role), roleKey(role), outcome.companySlug ?? null, JSON.stringify(steps), JSON.stringify(skills))
    .run();
  return { shared: true, steps, skills };
}
