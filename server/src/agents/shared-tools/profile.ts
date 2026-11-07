import type { ToolContext, ToolDefinition } from "../core/types";
import { profileFieldsSchema } from "./profile-schema";
import { keepGroundedSkills } from "../../memory/profile/grounding";
import { isEmptyPatch, parsePatch } from "../../memory/profile/patch";
import type { ProfilePatch, ProfileSkill } from "../../memory/profile/types";

function groundedSkills(skills: ProfileSkill[], ctx: ToolContext) {
  return ctx.groundingText ? keepGroundedSkills(skills, ctx.groundingText) : { kept: skills, dropped: 0 };
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
  parameters: profileFieldsSchema,
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
