import { defineAgent } from "../core/agent";
import { companyFacts } from "../shared-tools/company-facts";
import { companyInsights } from "../shared-tools/company-insights";
import { fetchPage } from "../shared-tools/fetch-page";
import { recall } from "../shared-tools/recall";
import { saveFact } from "../shared-tools/save-fact";
import { webSearch } from "../shared-tools/web-search";
import { card } from "./card";
import { interviewSkills } from "./skills";
import { devtoSearch } from "./tools/devto-search";
import { hnSearch } from "./tools/hn-search";
import { questionBank } from "./tools/question-bank";
import { queueResearch } from "./tools/queue-research";
import { remember } from "./tools/remember";

const own = [hnSearch, devtoSearch, queueResearch, remember, questionBank];
const shared = [companyFacts, companyInsights, fetchPage, recall, saveFact, webSearch];

export const interviewAgent = defineAgent(card, interviewSkills, [...own, ...shared]);
