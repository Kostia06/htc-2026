import { defineAgent } from "../core/agent";
import { companyInsights } from "../shared-tools/company-insights";
import { fetchPage } from "../shared-tools/fetch-page";
import { githubProfile } from "../shared-tools/github-profile";
import { readProfile } from "../shared-tools/profile";
import { recall } from "../shared-tools/recall";
import { webSearch } from "../shared-tools/web-search";
import { card } from "./card";
import { careerSkills } from "./skills";
import { jobPostings } from "./tools/job-postings";

// job_postings has no skill using it yet; it lives here because job search is career's job
export const careerAgent = defineAgent(card, careerSkills, [jobPostings, companyInsights, fetchPage, readProfile, recall, webSearch, githubProfile]);
