import type { AgentCard, AgentSkillCard } from "./directory";
import { type A2AAgentCard, type A2ASkill, PROTOCOL_VERSION } from "./types";

const JSON_MODE = ["application/json"];

function toA2ASkill(agentName: string, skill: AgentSkillCard): A2ASkill {
  return {
    id: skill.id,
    name: skill.name,
    description: `${skill.description} Call with SendMessage whose message has one data part {"skillId":"${skill.id}","input":{...}}; input JSON Schema: ${JSON.stringify(skill.inputSchema)}`,
    tags: [agentName],
    examples: [JSON.stringify({ skillId: skill.id, input: {} })],
    inputModes: JSON_MODE,
    outputModes: JSON_MODE,
  };
}

export function wellKnownCard(baseUrl: string, cards: AgentCard[]): A2AAgentCard {
  return {
    name: "Skillit",
    description: "Skillit's career agents (resume, research, interview, career) for a signed-in Skillit user.",
    version: "1.0.0",
    supportedInterfaces: [{ url: `${baseUrl}/a2a`, protocolBinding: "JSONRPC", protocolVersion: PROTOCOL_VERSION }],
    capabilities: { streaming: false, pushNotifications: false, extendedAgentCard: false },
    securitySchemes: {
      bearer: { httpAuthSecurityScheme: { scheme: "Bearer", description: "A Skillit session token or Supabase access token for the user the agents act for." } },
    },
    securityRequirements: [{ schemes: { bearer: { list: [] } } }],
    defaultInputModes: JSON_MODE,
    defaultOutputModes: JSON_MODE,
    skills: cards.flatMap((card) => card.skills.map((skill) => toA2ASkill(card.name, skill))),
  };
}
