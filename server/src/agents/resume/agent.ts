import { defineAgent } from "../core/agent";
import { companyInsights } from "../shared-tools/company-insights";
import { githubProfile } from "../shared-tools/github-profile";
import { readProfile, updateProfileTool } from "../shared-tools/profile";
import { card } from "./card";
import { resumeSkills } from "./skills";
import { readDocumentTool } from "./tools/read-document";

export const resumeAgent = defineAgent(card, resumeSkills, [readDocumentTool, readProfile, updateProfileTool, companyInsights, githubProfile]);
