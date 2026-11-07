import type { ToolContext, ToolDefinition } from "../core/types";
import { isEmptyPatch, parsePatch } from "../../memory/profile/patch";
import type { ProfilePatch, ProfileSkill } from "../../memory/profile/types";
import type { JsonSchema } from "../../lib/json-schema";

const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();

const listOf = (properties: Record<string, JsonSchema>, required: string[]): JsonSchema => ({
  type: "array",
  items: { type: "object", properties, required },
});
const textList: JsonSchema = { type: "array", items: { type: "string" } };

// a resume claim survives only if its evidence is a real quote from the text this run was given
function groundedSkills(skills: ProfileSkill[], ctx: ToolContext) {
  if (!ctx.groundingText) return { kept: skills, dropped: 0 };
  const source = normalize(ctx.groundingText);
  const kept = skills.filter((s) => s.source !== "resume" || (s.evidence !== undefined && source.includes(normalize(s.evidence))));
  return { kept, dropped: skills.length - kept.length };
}

export const readProfile: ToolDefinition = {
  name: "profile",
  description: "Read this person's profile: target roles, goals, skills with their evidence, education, experience, projects.",
  parameters: { type: "object", properties: {} },
  run: async (_args, ctx) => ctx.memory.profile(),
};

export const updateProfileTool: ToolDefinition = {
  name: "update_profile",
  description:
    "Add to this person's profile. Send only fields you learned. Every skill needs a source; a resume skill needs evidence quoted word for word from the resume.",
  parameters: {
    type: "object",
    properties: {
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
    },
  },
  run: async (args, ctx) => {
    const parsed = parsePatch(args);
    if (!parsed) return { updated: false, dropped: 0, reason: "send profile fields as an object" };
    const { kept, dropped } = groundedSkills(parsed.skills ?? [], ctx);
    const patch: ProfilePatch = { ...parsed, skills: kept.length ? kept : undefined };
    if (!patch.skills) delete patch.skills;
    if (isEmptyPatch(patch)) return { updated: false, dropped, reason: "nothing usable to save" };
    await ctx.memory.updateProfile(patch);
    return { updated: true, dropped };
  },
};
