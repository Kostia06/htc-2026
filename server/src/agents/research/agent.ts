import { defineAgent } from "../core/agent";
import { companyFacts } from "../shared-tools/company-facts";
import { fetchPage } from "../shared-tools/fetch-page";
import { saveFact } from "../shared-tools/save-fact";
import { webSearch } from "../shared-tools/web-search";
import { card } from "./card";
import { researchSkills } from "./skills";

export const researchAgent = defineAgent(card, researchSkills, [companyFacts, webSearch, fetchPage, saveFact]);
