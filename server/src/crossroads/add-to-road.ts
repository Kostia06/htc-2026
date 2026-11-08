import type { Env } from "../env";
import { goalOf } from "../roadmap/background";
import { insertSteps, loadAll, nextPosition } from "../roadmap/store";
import type { Step, StepContent, StepKind } from "../roadmap/types";
import { getProfile } from "../memory/profile/store";
import { interviewLines } from "./interviews";
import { laneOf } from "./lanes";
import { lineFor, type RoadLine } from "./patterns";

const MAX_TITLE = 90;
const clip = (text: string) => (text.length > MAX_TITLE ? `${text.slice(0, MAX_TITLE - 1).trimEnd()}…` : text);
const whoSaid = (line: RoadLine, what: string) => (line.people ? `${line.people} people on your road ${what}.` : `An example from your road: ${what}.`);

/** The step a road line becomes on the person's own road; null for kinds that are lived, not done (struggles, wins). */
export function stepForLine(line: RoadLine, goal: string): StepContent | null {
  if (line.kind === "tip") {
    return {
      kind: "project",
      title: clip(line.text),
      why: whoSaid(line, "said this worked"),
      detail: "Added from Crossroads. Mark it done once you've tried it.",
      estimate: "1 week",
      label: "ready_now",
    };
  }
  if (line.kind === "interview") {
    return {
      kind: "interview_practice",
      title: clip(`Practise: ${line.text}`),
      why: whoSaid(line, "were asked this"),
      detail: "Added from Crossroads. Run a mock interview that asks it.",
      estimate: "15 min",
      label: "ready_now",
      action: { type: "interview", role: goal },
    };
  }
  return null;
}

/** What the screen needs from the person's own road: step kinds they finished, and which lines are already on it. */
export function roadFacts(steps: Step[], lines: RoadLine[], goal: string): { done: StepKind[]; added: string[] } {
  const done = [...new Set(steps.filter((s) => s.status === "done" && s.kind !== "explore_memory").map((s) => s.kind))];
  const titles = new Set(steps.filter((s) => s.status !== "skipped").map((s) => s.title));
  const added = lines.filter((line) => {
    const step = stepForLine(line, goal);
    return step !== null && titles.has(step.title);
  });
  return { done, added: added.map((l) => l.id) };
}

async function findLine(env: Env, userId: string, id: string, goal: string): Promise<RoadLine | null> {
  if (id.startsWith("q_")) return (await interviewLines(env, laneOf(goal))).find((l) => l.id === id) ?? null;
  return lineFor(env, userId, id);
}

export type AddResult = { status: "added" | "already" } | { status: "unknown" | "not_addable" };

/** "Add to my road": turns a tip or an interview question into a step. Adding the same line twice is a no-op. */
export async function addLineToRoad(env: Env, userId: string, lineId: string): Promise<AddResult> {
  const goal = goalOf(await getProfile(env, userId));
  const line = await findLine(env, userId, lineId, goal);
  if (!line) return { status: "unknown" };
  const step = stepForLine(line, goal);
  if (!step) return { status: "not_addable" };
  const steps = await loadAll(env, userId);
  if (roadFacts(steps, [line], goal).added.length > 0) return { status: "already" };
  await insertSteps(env, userId, await nextPosition(env, userId), [step], "agent");
  return { status: "added" };
}
