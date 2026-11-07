import type { JsonSchema } from "../../lib/json-schema";

const listOf = (properties: Record<string, JsonSchema>, required: string[]): JsonSchema => ({
  type: "array",
  items: { type: "object", properties, required },
});
const textList: JsonSchema = { type: "array", items: { type: "string" } };

// the profile fields the agent may fill, shared by update_profile and the onboarding draft
export const profileFields: Record<string, JsonSchema> = {
  headline: { type: "string", description: "one line, e.g. 'Third-year computer science student'" },
  targetRoles: textList,
  goals: textList,
  certifications: textList,
  skills: listOf(
    {
      name: { type: "string" },
      source: { type: "string", enum: ["resume", "interview", "self-reported"] },
      evidence: { type: "string", description: "exact words from the text that show this skill" },
    },
    ["name", "source"],
  ),
  education: listOf({ school: { type: "string" }, program: { type: "string" }, year: { type: "string" }, expectedGraduation: { type: "string" } }, ["school"]),
  experience: listOf(
    { role: { type: "string" }, org: { type: "string" }, start: { type: "string" }, end: { type: "string" }, highlights: textList },
    ["role", "org"],
  ),
  projects: listOf({ name: { type: "string" }, summary: { type: "string" } }, ["name"]),
};

export const profileFieldsSchema: JsonSchema = { type: "object", properties: profileFields };
