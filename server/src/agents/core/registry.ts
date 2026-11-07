import { careerAgent } from "../career/agent";
import { interviewAgent } from "../interview/agent";
import { researchAgent } from "../research/agent";
import { resumeAgent } from "../resume/agent";
import type { Agent } from "./agent";
import type { AgentCard } from "./card";
import type { Skill } from "./types";

export const agents: readonly Agent[] = [resumeAgent, researchAgent, interviewAgent, careerAgent];

export function findSkill(skillId: string): { agent: Agent; skill: Skill } | undefined {
  const agent = agents.find((a) => Object.hasOwn(a.skills, skillId));
  return agent && { agent, skill: agent.skills[skillId] };
}

export function cards(): AgentCard[] {
  return agents.map((a) => a.card);
}
