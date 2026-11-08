import { db } from "../db";
import type { Env } from "../env";
import type { Profile } from "../memory/profile/types";
import { insertSteps } from "./store";
import type { StepContent } from "./types";

// fixed slots before the Crossroads step (-1) and the plan (0+): a resume lands once, and two first loads racing fight over the same slots
export const RESUME_POSITION = -60;
const MAX_RESUME_STEPS = 8;
const TITLE_LENGTH = 80;
const FROM_RESUME = "From your resume";

/** What the person has already done, read off their profile, as finished road steps in resume order. */
export function resumeSteps(profile: Profile): StepContent[] {
  const work = profile.experience.map((e): StepContent => {
    const highlights = e.highlights ?? [];
    return {
      kind: /volunt/i.test(`${e.role} ${e.org}`) ? "volunteering" : "project",
      title: `${e.role} at ${e.org}`.slice(0, TITLE_LENGTH),
      why: FROM_RESUME,
      detail: highlights.slice(0, 2).join(" ") || `${e.role} at ${e.org}`,
      estimate: [e.start, e.end].filter(Boolean).join("–") || "Done",
      label: "ready_now",
      note: highlights[0],
    };
  });
  const projects = profile.projects.map(
    (p): StepContent => ({ kind: "project", title: p.name.slice(0, TITLE_LENGTH), why: FROM_RESUME, detail: p.summary ?? "", estimate: "Done", label: "ready_now" }),
  );
  const certifications = profile.certifications.map(
    (c): StepContent => ({ kind: "certification", title: c.slice(0, TITLE_LENGTH), why: FROM_RESUME, detail: "", estimate: "Done", label: "ready_now" }),
  );
  return [...work, ...projects, ...certifications].slice(0, MAX_RESUME_STEPS);
}

/** Adds the resume to the road as finished steps unless it is already there. True when it was just added. */
export async function ensureResumeSteps(env: Env, userId: string, profile: Profile): Promise<boolean> {
  const steps = resumeSteps(profile);
  if (steps.length === 0) return false;
  const existing = await db(env).prepare("SELECT 1 AS ok FROM roadmap_steps WHERE user_id = ? AND position = ?").bind(userId, RESUME_POSITION).first();
  if (existing) return false;
  if (!(await insertSteps(env, userId, RESUME_POSITION, steps, "template"))) return false;
  const now = new Date().toISOString();
  await db(env).prepare(
    "UPDATE roadmap_steps SET status = 'done', completed_at = ?, completed_via = 'resume', updated_at = ? WHERE user_id = ? AND position >= ? AND position < ? AND status = 'todo'",
  )
    .bind(now, now, userId, RESUME_POSITION, RESUME_POSITION + steps.length)
    .run();
  return true;
}

/** Someone who has already built or worked on something skips the plan's first starter project. */
export const hasPriorWork = (profile: Profile) => profile.projects.length + profile.experience.length > 0;
