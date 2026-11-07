import type { Platform, Skill } from "./types";

// what an agent offers, for clients and outside callers to discover; never includes tools or instructions
export type AgentSkillCard = { id: string; name: string; description: string; platforms: Platform[]; inputSchema: Record<string, unknown> };
export type AgentCard = { name: string; description: string; skills: AgentSkillCard[] };

const readableName = (id: string) => {
  const words = id.replaceAll("-", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const skillCard = (skill: Skill): AgentSkillCard => ({
  id: skill.name,
  name: readableName(skill.name),
  description: skill.description,
  platforms: skill.platforms,
  inputSchema: skill.inputSchema,
});

export function agentCard(about: { name: string; description: string }, skills: Skill[]): AgentCard {
  return { ...about, skills: skills.map(skillCard) };
}
