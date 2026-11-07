import type { ToolDefinition } from "../core/types";
import { companyFacts } from "./company-facts";
import { companyInsights } from "./company-insights";
import { fetchPage } from "./fetch-page";
import { queueResearch } from "./queue-research";
import { recall } from "./recall";
import { remember } from "./remember";
import { saveFact } from "./save-fact";
import { webSearch } from "./web-search";

// finish is not here: each skill gets its own, shaped by its output schema
export const tools: Record<string, ToolDefinition> = Object.fromEntries(
  [webSearch, fetchPage, companyFacts, saveFact, companyInsights, recall, remember, queueResearch].map((t) => [t.name, t]),
);
