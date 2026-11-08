import type { AgentDeps, RunResult } from "../agents/core/types";
import { dispatch } from "../agents/orchestrator";
import { labelStep, type StepNeed } from "./label";
import { loadAll, rewriteStep } from "./store";
import type { Person } from "./templates";
import type { StepContent, StepKind } from "./types";

export type RefineRequest = { userId: string; person: Person; background: string };

type DraftStep = { kind: StepKind; title: string; why: string; detail: string; estimate: string; needs?: StepNeed[] };
type Draft = { steps: DraftStep[] };

const CLAIM_MS = 60_000;
const MAX_PREVIOUS = 60;
const clip = (text: string, max: number) => (text ?? "").trim().slice(0, max);

// runs after the response: rewrites the template steps the person hasn't touched into personal ones, in place,
// so the path keeps its ids and order and the next fetch simply reads better text. Never throws.
export async function refineTemplates(deps: AgentDeps, request: RefineRequest, deadlineMs: number): Promise<void> {
  if (!(await deps.services.claimCooldown("roadmap-refine", request.userId, CLAIM_MS))) return;
  const all = await loadAll(deps.env, request.userId);
  // the Crossroads step reads the same for everyone and must stay what it is
  const targets = all.filter((s) => s.source === "template" && s.status === "todo" && s.kind !== "explore_memory");
  if (targets.length === 0) return;
  const previous = all.filter((s) => !targets.includes(s)).map((s) => s.title);

  const run = await withDeadline(runSkill(deps, request, previous, targets.length), deadlineMs);
  if (run?.status !== "done") return;
  const drafts = (run.output as Draft).steps.slice(0, targets.length);
  for (const [i, draft] of drafts.entries()) {
    await rewriteStep(deps.env, request.userId, targets[i].id, fromDraft(draft, request));
  }
}

async function runSkill(deps: AgentDeps, request: RefineRequest, previous: string[], count: number): Promise<RunResult> {
  const input = {
    goal: clip(request.person.goal, 200),
    count,
    background: request.background || undefined,
    previous: previous.slice(-MAX_PREVIOUS).map((t) => clip(t, 120)),
  };
  const { result } = await dispatch(deps, { skillId: "roadmap-steps", platform: "app", userId: request.userId, input });
  return result;
}

async function withDeadline<T>(work: Promise<T>, ms: number): Promise<T | null> {
  const settled = work.catch((e: Error) => {
    console.error("roadmap refine failed", e.message);
    return null;
  });
  const timeout = new Promise<null>((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    void settled.finally(() => clearTimeout(timer));
  });
  return Promise.race([settled, timeout]);
}

function fromDraft(draft: DraftStep, request: RefineRequest): StepContent {
  const step: StepContent = {
    kind: draft.kind,
    title: clip(draft.title, 80),
    why: clip(draft.why, 160),
    detail: clip(draft.detail, 200),
    estimate: clip(draft.estimate, 40),
    label: labelStep(draft.needs ?? [], request.background),
  };
  if (draft.kind === "interview_practice") step.action = { type: "interview", role: request.person.goal };
  return step;
}
