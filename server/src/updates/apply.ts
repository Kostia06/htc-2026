import type { ProposedAction } from "../agents/career/skills/quick-update";
import type { PrivateMemoryPort } from "../agents/core/types";
import type { Env } from "../env";
import { anonymize } from "../lib/anonymize";
import { setStepStatus } from "../roadmap/store";
import type { Step } from "../roadmap/types";

export type Applied = { type: ProposedAction["type"]; summary: string };

const MAX_NAME = 120;
const MAX_NOTE = 500;
const EVENT_KINDS = new Set(["event", "networking_practice"]);

export type ApplyContext = {
  env: Env;
  userId: string;
  memory: PrivateMemoryPort;
  /** the person's open steps, the only ones an action may point at */
  openSteps: Step[];
  /** what the person actually typed or said this turn: the note a finished step keeps */
  said: string;
};

const clean = (value: unknown, max = MAX_NAME) => (typeof value === "string" ? anonymize(value.trim()).slice(0, max) : "");
const note = (...parts: (string | undefined)[]) => anonymize(parts.filter(Boolean).join(" ")).slice(0, MAX_NOTE) || undefined;

/** Every proposed action is checked against the person's own data before anything is written; an action that doesn't fit is dropped. */
export async function applyActions(ctx: ApplyContext, actions: ProposedAction[]): Promise<{ applied: Applied[]; dropped: number }> {
  const applied: Applied[] = [];
  let dropped = 0;
  for (const action of actions) {
    const result = await applyOne(ctx, action);
    if (result) applied.push(result);
    else dropped++;
  }
  return { applied, dropped };
}

async function applyOne(ctx: ApplyContext, action: ProposedAction): Promise<Applied | null> {
  switch (action.type) {
    case "complete_step":
      return markStep(ctx, action.stepId, "done");
    case "start_step":
      return markStep(ctx, action.stepId, "started");
    case "add_project": {
      const name = clean(action.name);
      if (!name) return null;
      await ctx.memory.updateProfile({ projects: [{ name, summary: clean(action.summary, 300) || undefined }] });
      return { type: action.type, summary: `Added project "${name}"` };
    }
    case "add_experience": {
      const role = clean(action.role);
      const org = clean(action.org);
      if (!role || !org) return null;
      await ctx.memory.updateProfile({ experience: [{ role, org, start: clean(action.when, 60) || undefined }] });
      return { type: action.type, summary: `Added ${role} at ${org}` };
    }
    case "add_skill": {
      const name = clean(action.name);
      if (!name) return null;
      await ctx.memory.updateProfile({ skills: [{ name, source: "self-reported" }] });
      return { type: action.type, summary: `Added skill ${name}` };
    }
    case "remove_skill": {
      const name = clean(action.name);
      if (!name) return null;
      await ctx.memory.updateProfile({ remove: { skills: [name] } });
      return { type: action.type, summary: `Removed skill ${name}` };
    }
    case "add_target_role": {
      const name = clean(action.name);
      if (!name) return null;
      await ctx.memory.updateProfile({ targetRoles: [name] });
      return { type: action.type, summary: `Added target role ${name}` };
    }
    case "attended_event": {
      const name = clean(action.name);
      if (!name) return null;
      const step = findStep(ctx, action.stepId);
      if (step && EVENT_KINDS.has(step.kind)) return markStep(ctx, step.id, "done", action.type);
      await ctx.memory.remember({ kind: "note", text: note(`Went to ${name}.`, ctx.said)! });
      return { type: action.type, summary: `Noted you went to ${name}` };
    }
    case "upcoming_interview": {
      const org = clean(action.org);
      if (!org) return null;
      const when = clean(action.when, 60);
      await ctx.memory.remember({ kind: "note", text: note(`Interview at ${org}${when ? ` (${when})` : ""}.`, ctx.said)! });
      return { type: action.type, summary: `Noted your interview at ${org}${when ? ` ${when}` : ""}` };
    }
    case "note": {
      const text = note(clean(action.summary, 300) || ctx.said);
      if (!text) return null;
      await ctx.memory.remember({ kind: "note", text });
      return { type: action.type, summary: "Kept a note" };
    }
    default:
      return null;
  }
}

const findStep = (ctx: ApplyContext, id: string | undefined) => (id ? ctx.openSteps.find((s) => s.id === id) : undefined);

// the store scopes by user as well, so a foreign id is refused twice: here, and again in SQL
async function markStep(ctx: ApplyContext, id: string | undefined, status: "done" | "started", type: Applied["type"] = status === "done" ? "complete_step" : "start_step") {
  const step = findStep(ctx, id);
  if (!step) return null;
  const saved = await setStepStatus(ctx.env, ctx.userId, step.id, status, status === "done" ? note(ctx.said) : undefined);
  if (!saved) return null;
  return { type, summary: `${status === "done" ? "Marked" : "Started"} "${saved.title}"${status === "done" ? " done" : ""}` };
}
