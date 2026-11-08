import type { AgentDeps, RunResult } from "../agents/core/types";
import { dispatch } from "../agents/orchestrator";
import { labelStep, type StepNeed } from "./label";
import { templateUnit } from "./templates";
import type { StepKind, UnitContent } from "./types";

export type UnitRequest = { userId: string; goal: string; background: string; index: number; previous: string[] };

type DraftStep = { kind: StepKind; title: string; why: string; estimate: string; needs?: StepNeed[] };
type Draft = { title: string; summary: string; steps: DraftStep[] };

const MAX_PREVIOUS = 60;
const clip = (text: string, max: number) => text.trim().slice(0, max);

// never throws and never takes longer than the deadline: a failed or slow model gets the field's template instead
export async function draftUnit(deps: AgentDeps, request: UnitRequest, deadlineMs: number): Promise<UnitContent> {
  const run = await withDeadline(runSkill(deps, request), deadlineMs);
  if (run?.status !== "done") return templateUnit(request.goal, request.index);
  return fromDraft(run.output as Draft, request.background);
}

async function runSkill(deps: AgentDeps, request: UnitRequest): Promise<RunResult> {
  const input = {
    goal: clip(request.goal, 200),
    unit: request.index,
    background: request.background || undefined,
    previous: request.previous.slice(-MAX_PREVIOUS).map((t) => clip(t, 120)),
  };
  const { result } = await dispatch(deps, { skillId: "roadmap-unit", platform: "app", userId: request.userId, input });
  return result;
}

async function withDeadline<T>(work: Promise<T>, ms: number): Promise<T | null> {
  const settled = work.catch((e: Error) => {
    console.error("roadmap unit failed", e.message);
    return null;
  });
  const timeout = new Promise<null>((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    void settled.finally(() => clearTimeout(timer));
  });
  return Promise.race([settled, timeout]);
}

function fromDraft(draft: Draft, background: string): UnitContent {
  return {
    title: clip(draft.title, 60),
    summary: clip(draft.summary, 140),
    source: "agent",
    steps: draft.steps.map((step) => ({
      id: `st_${crypto.randomUUID()}`,
      kind: step.kind,
      title: clip(step.title, 80),
      why: clip(step.why, 160),
      estimate: clip(step.estimate, 40),
      label: labelStep(step.needs ?? [], background),
    })),
  };
}
