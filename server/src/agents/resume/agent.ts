import { defineAgent } from "../core/agent";
import { readProfile, updateProfileTool } from "../shared-tools/profile";
import { card } from "./card";
import { resumeSkills } from "./skills";
import { readDocumentTool } from "./tools/read-document";

export const resumeAgent = defineAgent(card, resumeSkills, [readDocumentTool, readProfile, updateProfileTool]);
