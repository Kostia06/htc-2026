import type { AgentDeps } from "../agents/core/types";
import { db } from "../db";
import type { Env } from "../env";
import { insertSteps, nextPosition } from "../roadmap/store";
import type { StepContent } from "../roadmap/types";
import { missingRequirements } from "./match";
import type { PostingRequirement, Prefilled } from "./types";

export const MAX_GAP_STEPS = 3;
const clip = (text: string, max: number) => text.trim().slice(0, max);

export function slugify(name: string) {
  return name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

// the company becomes one Raven researches, shared by everyone; a name that slugs to nothing stays a plain string
export async function ensureCompany(env: Env, name: string): Promise<{ slug: string; name: string } | null> {
  const slug = slugify(name).slice(0, 100);
  if (!slug) return null;
  await db(env).prepare("INSERT OR IGNORE INTO companies (id, slug, name) VALUES (?, ?, ?)").bind(`co_${crypto.randomUUID()}`, slug, clip(name, 120)).run();
  const row = await db(env).prepare("SELECT slug, name FROM companies WHERE slug = ?").bind(slug).first<{ slug: string; name: string }>();
  return row ?? null;
}

type PrefillInput = {
  userId: string;
  postingId: string;
  title: string;
  company: string;
  requirements: PostingRequirement[];
};

/** Everything a posting sets up for the person: a target role, a researched company, and the steps to close the gaps. Never throws. */
export async function prefillFromPosting(deps: AgentDeps, input: PrefillInput): Promise<Prefilled> {
  const [targetRole, company] = await Promise.all([addTargetRole(deps, input), researchedCompany(deps, input.company)]);
  const steps = await addSteps(deps.env, input, company?.slug ?? null);
  return { targetRole, company, steps };
}

async function addTargetRole(deps: AgentDeps, input: PrefillInput) {
  const role = clip(input.title, 120);
  if (!role) return null;
  try {
    await deps.memoryFor(input.userId).updateProfile({ targetRoles: [role] });
    return role;
  } catch (e) {
    console.error("posting: target role not added", (e as Error).message);
    return null;
  }
}

async function researchedCompany(deps: AgentDeps, name: string) {
  const company = await ensureCompany(deps.env, name).catch(() => null);
  if (!company) return null;
  const researchQueued = await deps.services.startResearch(company.slug).catch(() => false);
  return { ...company, researchQueued };
}

async function addSteps(env: Env, input: PrefillInput, companySlug: string | null) {
  const contents = [...missingRequirements(input.requirements).slice(0, MAX_GAP_STEPS).map((r) => gapStep(r, input.company)), interviewStep(input, companySlug)];
  try {
    const inserted = await insertSteps(env, input.userId, await nextPosition(env, input.userId), contents, "agent");
    return inserted ? contents.map((c) => c.title) : [];
  } catch (e) {
    console.error("posting: steps not added", (e as Error).message);
    return [];
  }
}

function gapStep(requirement: PostingRequirement, company: string): StepContent {
  const topic = clip(requirement.topic, 40) || clip(requirement.text, 40);
  return {
    kind: "course",
    title: clip(`Build up ${topic}`, 80),
    why: clip(`${company} asks for it: ${requirement.text}`, 160),
    detail: clip(`Spend a few sessions on ${topic}, then add it to your profile with something you made.`, 200),
    estimate: "2 weeks",
    label: requirement.required ? "stretch" : "ready_now",
  };
}

function interviewStep(input: PrefillInput, companySlug: string | null): StepContent {
  const role = clip(input.title, 100);
  return {
    kind: "interview_practice",
    title: clip(`Practice the ${role} interview`, 80),
    why: clip(`You're preparing for ${input.company}'s ${role} posting`, 160),
    detail: "Skillit asks about the posting's requirements and what you'd be doing in the role.",
    estimate: "15 min",
    label: "ready_now",
    action: { type: "interview", companySlug: companySlug ?? undefined, role, postingId: input.postingId },
  };
}
