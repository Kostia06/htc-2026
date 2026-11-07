import type { ToolDefinition } from "../core/types";
import { companyFacts } from "../shared-tools/company-facts";
import { companyInsights } from "../shared-tools/company-insights";
import { devtoSearch } from "../interview/tools/devto-search";
import { fetchPage } from "../shared-tools/fetch-page";
import { hnSearch } from "../interview/tools/hn-search";
import { jobPostings } from "../career/tools/job-postings";
import { readProfile, updateProfileTool } from "../shared-tools/profile";
import { readDocumentTool } from "../resume/tools/read-document";
import { queueResearch } from "../interview/tools/queue-research";
import { recall } from "../shared-tools/recall";
import { remember } from "../interview/tools/remember";
import { saveFact } from "../shared-tools/save-fact";
import { webSearch } from "../shared-tools/web-search";

// finish is not here: each skill gets its own, shaped by its output schema
export const tools: Record<string, ToolDefinition> = Object.fromEntries(
  [webSearch, fetchPage, companyFacts, saveFact, companyInsights, recall, remember, readProfile, updateProfileTool, readDocumentTool, queueResearch, jobPostings, hnSearch, devtoSearch].map((t) => [t.name, t]),
);
