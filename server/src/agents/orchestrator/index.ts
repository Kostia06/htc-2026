import { startSkill } from "../core/harness";
import { findSkill } from "../core/registry";
import type { AgentDeps, Platform, RunResult, Skill } from "../core/types";
import { handOff } from "./handoff";

export type Task = { skillId: string; platform: Platform; userId: string; input: unknown };

export class UnknownSkill extends Error {
  readonly skillId: string;
  constructor(skillId: string) {
    super(`no agent has the skill ${skillId}`);
    this.skillId = skillId;
  }
}

// the only path from a request to an agent: agents never call each other, handoffs happen here.
// Resolves once the run is recorded; the result is a promise so callers can wait or not.
export async function dispatch(deps: AgentDeps, task: Task): Promise<{ runId: string; skill: Skill; result: Promise<RunResult> }> {
  const found = findSkill(task.skillId);
  if (!found) throw new UnknownSkill(task.skillId);
  const { skill, agent } = found;
  const started = await startSkill(deps, { skill, tools: agent.tools, platform: task.platform, userId: task.userId, input: task.input });
  // after startSkill, so a rejected request hands nothing off; joined to the result so the work is never orphaned
  const handoff = handOff(deps, skill.name, task.input);
  const result = Promise.all([started.result, handoff]).then(([run]) => run);
  return { runId: started.runId, skill, result };
}

export async function orchestrate(deps: AgentDeps, task: Task): Promise<RunResult> {
  return (await dispatch(deps, task)).result;
}
