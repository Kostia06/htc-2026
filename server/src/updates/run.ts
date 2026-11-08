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

/** `focusStepId` is the step whose "Mark done" opened the chat: it is marked done whatever the model makes of the words. */
type UpdateTurn = { userId: string; messages: UpdateMessage[]; focusStepId?: string; timeoutMs?: number; waitUntil?: (work: Promise<unknown>) => void };

/** One question per update: once Skillit has replied to what the person said, there is none left. */
export const canStillAsk = (messages: UpdateMessage[]) => {
  const firstUser = messages.findIndex((m) => m.role === "user");
  return firstUser < 0 || !messages.slice(firstUser).some((m) => m.role === "raven");
};

const lastSaid = (messages: UpdateMessage[]) => [...messages].reverse().find((m) => m.role === "user")?.text.trim() ?? "";

export function withTimeout<T>(work: Promise<T>, ms: number, keepAlive?: (work: Promise<unknown>) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      // the run goes on recording itself after the reply has gone out; nobody waits for it
      keepAlive?.(work.catch(() => undefined));
      reject(new UpdateTimedOut("the model took too long"));
    }, ms);
    work.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

export function confirmation(applied: Applied[]) {
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

  const ctx = { env: deps.env, userId: turn.userId, memory, openSteps, said: lastSaid(messages) };
  // only one of their open steps can be the focus, so a foreign or finished id changes nothing
  const focus = openSteps.find((s) => s.id === turn.focusStepId);
  const markFocus = async () => (await applyActions(ctx, [{ type: "complete_step", stepId: focus!.id }])).applied;

  let output: QuickUpdateOutput;
  try {
    const run = await withTimeout(
      orchestrate(deps, { skillId: "quick-update", platform: "app", userId: turn.userId, input }),
      turn.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      turn.waitUntil,
    );
    if (run.status === "failed") throw new UpdateFailed(run.error);
    output = run.output as QuickUpdateOutput;
  } catch (e) {
    // a model that fails or stalls can't stop "Mark done"; anything else (a refused run) still surfaces
    if (!focus || !(e instanceof UpdateFailed || e instanceof UpdateTimedOut)) throw e;
    const applied = await markFocus();
    return { reply: confirmation(applied), needsAnswer: false, applied };
  }
  // with a focus the step is already known, so a question (and the guesses that came with it) is not needed
  if (output.needsAnswer && focus) {
    const applied = await markFocus();
    return { reply: confirmation(applied), needsAnswer: false, applied };
  }
  if (output.needsAnswer) return { reply: output.reply, needsAnswer: true, applied: [] };

  // an unknown key stays as it is and is refused by applyActions, like any other id that isn't theirs
  const proposed: ProposedAction[] = (output.actions ?? [])
    .map((a) => (a.stepId ? { ...a, stepId: idOf.get(a.stepId) ?? a.stepId } : a))
    .filter((a) => !focus || a.stepId !== focus.id);
  const focused = focus ? await markFocus() : [];
  const { applied, dropped } = await applyActions(ctx, proposed);
  const all = [...focused, ...applied];
  // the model's line promised what it proposed; when any of that was refused, say what really happened instead
  const reply = dropped > 0 || (all.length === 0 && !output.reply) ? confirmation(all) : output.reply;
  return { reply, needsAnswer: false, applied: all };
}
