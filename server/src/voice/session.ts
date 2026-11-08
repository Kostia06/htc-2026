import type { Env } from "../env";
import { getCompanyInsights } from "../memory/insights";
import { getProfile } from "../memory/profile/store";
import { findPosting } from "../postings/store";
import { liveInstructions, openingLine } from "./instructions";
import { voiceProvider } from "./providers";
import { buildInterviewPlan, type PlanInputs } from "./plan";
import { createSession } from "./store";
import type { Difficulty, InterviewLength, VoiceMode, VoicePlan } from "./types";

export class UnknownCompany extends Error {}
export class UnknownPosting extends Error {}

type StartRequest = {
  mode: VoiceMode;
  companySlug?: string;
  role?: string;
  difficulty?: Difficulty;
  length?: InterviewLength;
  postingId?: string;
  stepId?: string;
};

// a posting decides the role and the company; a role or company sent alongside it is ignored
async function withPosting(env: Env, userId: string, request: StartRequest) {
  if (!request.postingId) return { ...request, posting: undefined };
  const posting = await findPosting(env, userId, request.postingId);
  if (!posting) throw new UnknownPosting(request.postingId);
  return { ...request, role: posting.title, companySlug: posting.companySlug ?? undefined, posting };
}

async function planInputs(env: Env, userId: string, start: StartRequest): Promise<PlanInputs> {
  const request = await withPosting(env, userId, start);
  const profile = await getProfile(env, userId);
  const insights = request.companySlug ? await getCompanyInsights(env, request.companySlug, request.role) : null;
  if (request.companySlug && !insights) throw new UnknownCompany(request.companySlug);
  return {
    role: request.role ?? profile.targetRoles[0] ?? "entry-level",
    company: insights?.company ?? null,
    reportedQuestions: insights?.questions ?? [],
    facts: insights?.facts ?? [],
    profile,
    difficulty: request.difficulty,
    length: request.length,
    posting: request.posting && { requirements: request.posting.requirements.map(({ text, have }) => ({ text, have })), responsibilities: request.posting.responsibilities },
  };
}

// what the client shows before the voice starts; the full plan stays server-side in the live instructions
function publicPlan(plan: VoicePlan) {
  return { length: plan.length ?? "full", questions: plan.questions.map(({ text, source }) => ({ text, source })) };
}

export async function startVoiceSession(env: Env, userId: string, request: StartRequest) {
  const inputs = await planInputs(env, userId, request);
  const plan = buildInterviewPlan(inputs);
  const opening = openingLine(plan);
  const voice = await voiceProvider(env).startSession(env, { instructions: liveInstructions(plan), opening });
  const sessionId = await createSession(env, userId, { mode: request.mode, companySlug: inputs.company?.slug ?? null, stepId: request.stepId, plan });
  return {
    sessionId,
    mode: request.mode,
    ...voice,
    opening,
    role: plan.role,
    company: plan.company,
    ...publicPlan(plan),
  };
}
