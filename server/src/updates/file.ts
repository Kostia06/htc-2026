import type { DocumentUpdateInput, DocumentUpdateOutput } from "../agents/career/skills/document-update";
import type { ProposedAction } from "../agents/career/skills/quick-update";
import type { AgentDeps } from "../agents/core/types";
import { orchestrate } from "../agents/orchestrator";
import { anonymize } from "../lib/anonymize";
import type { Profile } from "../memory/profile/types";
import { loadOpen } from "../roadmap/store";
import { applyActions, type Applied } from "./apply";
import { confirmation, UpdateFailed, withTimeout } from "./run";

export type FileUpdateResult = { reply: string; applied: Applied[] };

/** a document is read by the model first (PDFs, images) and then turned into actions: longer than a typed update */
export const FILE_TIMEOUT_MS = 30_000;
const MAX_STEPS = 40;
const MAX_COURSES_NOTE = 1500;
export const NOTHING_NEW = "I read your file, but found nothing new to add.";

type FileTurn = { userId: string; fileName: string; text: string; timeoutMs?: number; waitUntil?: (work: Promise<unknown>) => void };

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
const keyOf = (value: string | undefined) => normalize(value ?? "");

// every name the model copied must really be in the document; a free-text extra that isn't is dropped, a name that isn't drops the action
const NAMED_FIELDS = ["name", "role", "org", "school", "program"] as const;
const OPTIONAL_FIELDS = ["when", "summary"] as const;

function grounded(action: ProposedAction, source: string): ProposedAction | null {
  const inDocument = (value: string) => source.includes(normalize(value));
  if (NAMED_FIELDS.some((field) => action[field] !== undefined && !inDocument(action[field]!))) return null;
  // completing a step needs the course or certificate that proves it, not just the model's word
  if (action.type === "complete_step" && !action.name) return null;
  const kept = { ...action };
  for (const field of OPTIONAL_FIELDS) if (kept[field] !== undefined && !inDocument(kept[field]!)) delete kept[field];
  return kept;
}

// the profile merge already ignores exact repeats; these also catch the same job with a differently written date,
// and keep "Added skill Python" out of the reply when Python was there all along
function alreadyKnown(action: ProposedAction, profile: Profile) {
  switch (action.type) {
    case "add_skill":
      return profile.skills.some((s) => keyOf(s.name) === keyOf(action.name));
    case "add_certification":
      return profile.certifications.some((c) => keyOf(c) === keyOf(action.name));
    case "add_project":
      return profile.projects.some((p) => keyOf(p.name) === keyOf(action.name));
    case "add_experience":
      return profile.experience.some((e) => keyOf(e.role) === keyOf(action.role) && keyOf(e.org) === keyOf(action.org));
    case "add_education":
      return profile.education.some((e) => keyOf(e.school) === keyOf(action.school) && (!action.program || keyOf(e.program) === keyOf(action.program)));
    default:
      return false;
  }
}

const identity = (a: ProposedAction) => [a.type, a.stepId, a.name, a.role, a.org, a.school, a.program].map(keyOf).join("|");
function unique(actions: ProposedAction[]) {
  const seen = new Set<string>();
  return actions.filter((a) => !seen.has(identity(a)) && Boolean(seen.add(identity(a))));
}

function contextFor(profile: Profile): Omit<DocumentUpdateInput, "fileName" | "text" | "steps"> {
  return {
    skills: profile.skills.map((s) => s.name),
    education: profile.education.map((e) => (e.program ? `${e.program} at ${e.school}` : e.school)),
    experience: profile.experience.map((e) => `${e.role} at ${e.org}`),
    certifications: profile.certifications,
    projects: profile.projects.map((p) => p.name),
  };
}

/** One uploaded document: the model proposes, code keeps only what the document states and the person doesn't have yet, then applies it. */
export async function runFileUpdate(deps: AgentDeps, turn: FileTurn): Promise<FileUpdateResult> {
  const memory = deps.memoryFor(turn.userId);
  const [openSteps, profile] = await Promise.all([loadOpen(deps.env, turn.userId, 0, MAX_STEPS), memory.profile()]);
  // the same short keys as a typed update: easier to copy, safe from the digit-run scrub
  const keyOfStep = new Map(openSteps.map((s, i) => [s.id, `s${i + 1}`]));
  const idOf = new Map(openSteps.map((s, i) => [`s${i + 1}`, s.id]));
  const fileName = anonymize(turn.fileName).slice(0, 120) || "file";
  const input: DocumentUpdateInput = {
    fileName,
    text: turn.text,
    steps: openSteps.map((s) => ({ id: keyOfStep.get(s.id)!, title: s.title, kind: s.kind })),
    ...contextFor(profile),
  };

  const run = await withTimeout(
    orchestrate(deps, { skillId: "document-update", platform: "app", userId: turn.userId, input }),
    turn.timeoutMs ?? FILE_TIMEOUT_MS,
    turn.waitUntil,
  );
  if (run.status === "failed") {
    console.warn("[file-update] document-update failed:", run.error);
    throw new UpdateFailed(run.error);
  }
  const output = run.output as DocumentUpdateOutput;

  const source = normalize(turn.text);
  const proposed = (output.actions ?? []).map((a) => (a.stepId ? { ...a, stepId: idOf.get(a.stepId) ?? a.stepId } : a));
  const checked = proposed.map((a) => grounded(a, source)).filter((a): a is ProposedAction => a !== null);
  const fresh = unique(checked.filter((a) => !alreadyKnown(a, profile)));

  const courses = fresh.filter((a) => a.type === "add_course").map((a) => a.name!.trim());
  const ctx = { env: deps.env, userId: turn.userId, memory, openSteps, said: `Shown in ${fileName}` };
  const { applied, dropped } = await applyActions(ctx, fresh.filter((a) => a.type !== "add_course"));
  const all = [...applied, ...(await noteCourses(memory, fileName, courses))];

  if (all.length === 0) return { reply: NOTHING_NEW, applied: [] };
  // the model's line described what it proposed; when any of that was thrown out, say what really happened instead
  const thrownOut = dropped + (proposed.length - checked.length);
  return { reply: thrownOut > 0 || !output.reply ? confirmation(all) : output.reply, applied: all };
}

// courses have no profile field: they are one private note, which the agents recall when planning the road
async function noteCourses(memory: ReturnType<AgentDeps["memoryFor"]>, fileName: string, courses: string[]): Promise<Applied[]> {
  if (courses.length === 0) return [];
  const text = anonymize(`Courses taken (from ${fileName}): ${courses.join("; ")}.`).slice(0, MAX_COURSES_NOTE);
  await memory.remember({ kind: "note", text });
  return [{ type: "add_course", summary: `Noted ${courses.length} course${courses.length === 1 ? "" : "s"} you've taken` }];
}
