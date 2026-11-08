import type { CrossroadsAskInput, CrossroadsAskOutput } from "../agents/career/skills/crossroads-ask";
import type { UpdateMessage } from "../agents/career/skills/quick-update";
import type { AgentDeps } from "../agents/core/types";
import { orchestrate } from "../agents/orchestrator";
import { canStillAsk } from "../updates/run";
import { finishExploreStep } from "./explore-step";
import { crossroadsFor, type Crossroads } from "./view";

export type CiteType = "you" | "everyone" | "trail" | "research";
/** What an answer leaned on, so the screen can light up the same items. `id` is the item's id in GET /api/crossroads. */
export type Cite = { type: CiteType; id: string };
export type AskResult = { reply: string; needsAnswer: boolean; cites: Cite[] };

export class AskFailed extends Error {}

const MAX_MESSAGES = 20;
const clip = (text: string, max = 400) => text.slice(0, max);

// the model sees short keys, never real ids: easy to copy back and nothing to leak
function keyed(view: Crossroads) {
  const ids = new Map<string, Cite>();
  const key = (prefix: string, type: CiteType, id: string, i: number) => {
    const k = `${prefix}${i + 1}`;
    ids.set(k, { type, id });
    return k;
  };
  const keyOf = new Map<string, string>();
  const you = view.you.map((y, i) => {
    const k = key("y", "you", y.id, i);
    keyOf.set(y.id, k);
    return { key: k, kind: y.kind, text: clip(y.text) };
  });
  const everyone = view.everyone.map((e, i) => {
    const k = key("e", "everyone", e.id, i);
    keyOf.set(e.id, k);
    return { key: k, kind: e.kind, text: clip(e.text), people: e.people ?? 0, example: e.example };
  });
  const trails = view.trails.map((t, i) => ({
    key: key("t", "trail", t.id, i),
    text: `${t.role}: ${t.steps.join(" → ")}${t.skills.length ? `; skills ${t.skills.join(", ")}` : ""}`,
    people: t.people ?? 0,
    example: t.example,
  }));
  const research = view.research.map((r, i) => {
    const k = key("r", "research", r.id, i);
    keyOf.set(r.id, k);
    return { key: k, company: r.company, text: clip(r.text), ageDays: r.ageDays };
  });
  const links = view.links.map((l) => `${keyOf.get(l.you)} ~ ${keyOf.get(l.everyone)}`).filter((l) => !l.includes("undefined"));
  return { ids, you, everyone, trails, research, links };
}

/** One Crossroads question, answered only from the person's own items and the road's aggregates. */
export async function askCrossroads(deps: AgentDeps, userId: string, conversation: UpdateMessage[]): Promise<AskResult> {
  const view = await crossroadsFor(deps.env, userId);
  const { ids, ...context } = keyed(view);
  const messages = conversation.slice(-MAX_MESSAGES);
  const input: CrossroadsAskInput = { messages, canAsk: canStillAsk(messages), goal: view.road.goal, ...context };

  const run = await orchestrate(deps, { skillId: "crossroads-ask", platform: "app", userId, input });
  if (run.status === "failed") throw new AskFailed(run.error);
  await finishExploreStep(deps.env, userId);

  const output = run.output as CrossroadsAskOutput;
  const cites = output.cites.map((k) => ids.get(k)).filter((c): c is Cite => c !== undefined);
  return { reply: output.reply, needsAnswer: output.needsAnswer, cites };
}
