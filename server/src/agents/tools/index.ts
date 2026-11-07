import type { ToolDefinition } from "../core/types";
import { companyFacts } from "./company-facts";
import { companyInsights } from "./company-insights";
import { devtoSearch } from "./devto-search";
import { fetchPage } from "./fetch-page";
import { hnSearch } from "./hn-search";
import { jobPostings } from "./job-postings";
import { readProfile, updateProfileTool } from "./profile";
import { readDocumentTool } from "./read-document";
import { queueResearch } from "./queue-research";
import { recall } from "./recall";
import { remember } from "./remember";
import { saveFact } from "./save-fact";
import { webSearch } from "./web-search";

// finish is not here: each skill gets its own, shaped by its output schema
export const tools: Record<string, ToolDefinition> = Object.fromEntries(
  [webSearch, fetchPage, companyFacts, saveFact, companyInsights, recall, remember, readProfile, updateProfileTool, readDocumentTool, queueResearch, jobPostings, hnSearch, devtoSearch].map((t) => [t.name, t]),
);
