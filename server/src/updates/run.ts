import { capWords, type ProposedAction, type QuickUpdateInput, type QuickUpdateOutput, type UpdateMessage } from "../agents/career/skills/quick-update";
import type { AgentDeps } from "../agents/core/types";
import { orchestrate } from "../agents/orchestrator";
import { loadOpen } from "../roadmap/store";
import { applyActions, type Applied } from "./apply";

export type UpdateResult = { reply: string; needsAnswer: boolean; applied: Applied[] };

export class UpdateFailed extends Error {}
export class UpdateTimedOut extends Error {}

export const DEFAULT_TIMEOUT_MS = 6_000;
const MAX_MESSAGES = 20;
const MAX_STEPS = 40;

type UpdateTurn = { userId: string; messages: UpdateMessage[]; timeoutMs?: number; waitUntil?: (work: Promise<unknown>) => void };

/** One question per update: once Skillit has replied to what the person said, there is none left. */
export const canStillAsk = (messages: UpdateMessage[]) => {
  const firstUser = messages.findIndex((m) => m.role === "user");
  return firstUser < 0 || !messages.slice(firstUser).some((m) => m.role === "raven");
};

const lastSaid = (messages: UpdateMessage[]) => [...messages].reverse().find((m) => m.role === "user")?.text.trim() ?? "";

function withTimeout<T>(work: Promise<T>, ms: number, keepAlive?: (work: Promise<unknown>) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      // the run goes on recording itself after the reply has gone out; nobody waits for it
      keepAlive?.(work.catch(() => undefined));
      reject(new UpdateTimedOut("the model took too long"));
    }, ms);
    work.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

function confirmation(applied: Applied[]) {
  if (applied.length === 0) return "I couldn't match that to anything of yours yet. Tell me a bit more?";
  const [first, ...rest] = applied;
  return capWords(`${first.summary}${rest.length ? ` and ${rest.length} more` : ""}.`);
}

/** One update: the model proposes actions from the person's words; code checks each one against their own data and applies it. */
export async function runQuickUpdate(deps: AgentDeps, turn: UpdateTurn): Promise<UpdateResult> {
  const memory = deps.memoryFor(turn.userId);
  const [openSteps, profile] = await Promise.all([loadOpen(deps.env, turn.userId, 0, MAX_STEPS), memory.profile()]);
  const messages = turn.messages.slice(-MAX_MESSAGES);
  // the model sees short keys, not real ids: easier to copy, and safe from the contact-detail scrub that mangles digit runs
  const keyOf = new Map(openSteps.map((s, i) => [s.id, `s${i + 1}`]));
  const idOf = new Map(openSteps.map((s, i) => [`s${i + 1}`, s.id]));
  const input: QuickUpdateInput = {
    messages,
    canAsk: canStillAsk(messages),
    steps: openSteps.map((s) => ({ id: keyOf.get(s.id)!, title: s.title, kind: s.kind })),
    skills: profile.skills.map((s) => s.name),
    targetRoles: profile.targetRoles,
    projects: profile.projects.map((p) => p.name),
  };

  const run = await withTimeout(
    orchestrate(deps, { skillId: "quick-update", platform: "app", userId: turn.userId, input }),
    turn.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    turn.waitUntil,
  );
  if (run.status === "failed") throw new UpdateFailed(run.error);

  const output = run.output as QuickUpdateOutput;
  if (output.needsAnswer) return { reply: output.reply, needsAnswer: true, applied: [] };

  // an unknown key stays as it is and is refused by applyActions, like any other id that isn't theirs
  const proposed: ProposedAction[] = (output.actions ?? []).map((a) => (a.stepId ? { ...a, stepId: idOf.get(a.stepId) ?? a.stepId } : a));
  const { applied, dropped } = await applyActions({ env: deps.env, userId: turn.userId, memory, openSteps, said: lastSaid(messages) }, proposed);
  // the model's line promised what it proposed; when any of that was refused, say what really happened instead
  const reply = dropped > 0 || (applied.length === 0 && !output.reply) ? confirmation(applied) : output.reply;
  return { reply, needsAnswer: false, applied };
}
