import type { AgentCard } from "./card";
import type { Skill, ToolDefinition, Toolbox } from "./types";

export type Agent = { card: AgentCard; skills: Record<string, Skill>; tools: Toolbox };

// checked once at startup, so a skill wired to a tool its agent doesn't hold fails loudly, not mid-run
export function defineAgent(card: AgentCard, skills: Skill[], tools: ToolDefinition[]): Agent {
  const toolbox: Toolbox = Object.fromEntries(tools.map((t) => [t.name, t]));
  for (const skill of skills) {
    const missing = skill.tools.filter((name) => !Object.hasOwn(toolbox, name));
    if (missing.length) throw new Error(`${skill.name} uses ${missing.join(", ")}, which the ${card.name} agent does not hold`);
  }
  const listed = card.skills.map((s) => s.id).join(",");
  if (listed !== skills.map((s) => s.name).join(",")) throw new Error(`the ${card.name} card does not list the agent's skills`);
  return { card, skills: Object.fromEntries(skills.map((s) => [s.name, s])), tools: toolbox };
}
