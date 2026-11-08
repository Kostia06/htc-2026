import type { Env } from "../env";
import { getCompanyInsights } from "../memory/insights";
import { getProfile } from "../memory/profile/store";
import { liveInstructions, openingLine } from "./instructions";
import { voiceProvider } from "./providers";
import { buildInterviewPlan, buildNetworkingPlan, type PlanInputs } from "./plan";
import { createSession } from "./store";
import type { Difficulty, VoiceMode, VoicePlan } from "./types";

export class UnknownCompany extends Error {}

type StartRequest = { mode: VoiceMode; companySlug?: string; role?: string; difficulty?: Difficulty };

async function planInputs(env: Env, userId: string, request: StartRequest): Promise<PlanInputs> {
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
  };
}

// what the client shows before the voice starts; the full plan stays server-side in the live instructions
function publicPlan(plan: VoicePlan) {
  if (plan.mode === "interview") return { questions: plan.questions.map(({ text, source }) => ({ text, source })) };
  return { persona: plan.persona, goals: plan.goals };
}

export async function startVoiceSession(env: Env, userId: string, request: StartRequest) {
  const inputs = await planInputs(env, userId, request);
  const plan = request.mode === "interview" ? buildInterviewPlan(inputs) : buildNetworkingPlan(inputs);
  const opening = openingLine(plan);
  const voice = await voiceProvider(env).startSession(env, { mode: request.mode, instructions: liveInstructions(plan), opening });
  const sessionId = await createSession(env, userId, { mode: request.mode, companySlug: request.companySlug ?? null, plan });
  return {
    sessionId,
    mode: request.mode,
    ...voice,
    opening,
    ...publicPlan(plan),
  };
}
