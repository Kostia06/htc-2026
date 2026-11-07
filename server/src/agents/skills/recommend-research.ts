import { draftItemProperties, draftItemRequired, EXTRACTION_RULES, MAX_ITEMS } from "../../recommend/draft-schema";
import { readProfileFromToolCalls, type ProfileReader } from "../../recommend/profile";
import { recommend, type DraftItem, type Judge } from "../../recommend/recommend";
import { assessFit, capAtStretch } from "../../recommend/rubric";
import { containsQuote } from "../../recommend/verify";
import type { Skill } from "../core/types";

type ResearchDraft = DraftItem & { listing: "program" | "lab"; opening_quote?: string };

const SAME_LEVEL = { role: 0, person: 0 };
const PROGRAM_NOTE = "This is a funding program, not a job opening: you still need a supervisor to agree to take you on.";
const LAB_NOTE = "This lab page says who they take, not that a position is open.";

// labs take undergraduates at the supervisor's discretion, so only a posted opening can make one ready now
const judgeResearch: Judge<ResearchDraft> = (draft, { requirements, source }) => {
  const assessment = assessFit({ requirements, experienceGapYears: 0, jobZone: SAME_LEVEL, separatesRequired: true });
  if (draft.listing === "program") return { assessment, note: PROGRAM_NOTE };
  if (draft.opening_quote && containsQuote(source, draft.opening_quote)) return { assessment };
  return { assessment: capAtStretch(assessment, "The lab doesn't post an opening, so reach out rather than apply."), note: LAB_NOTE };
};

export function recommendResearchWith(readProfile: ProfileReader): Skill<{ interest?: string }> {
  return {
    name: "recommend-research",
    description: "Recommend undergraduate research routes at the University of Calgary: UREX, USRA and labs that take students.",
    platforms: ["app"],
    personal: true,
    tools: ["profile", "recall", "web_search", "fetch_page"],
    maxSteps: 12,
    instructions: `Recommend up to ${MAX_ITEMS} undergraduate research routes at the University of Calgary for this person.
1. Call profile, then recall for kinds goal and skill.
2. Fetch the official pages you recommend with fetch_page:
   - the UREX Award, formerly PURE (https://www.ucalgary.ca/experiential-learning/undergraduate-research/pure).
     Its eligibility is hard: cumulative GPA of at least 2.0, and continuing in the following fall (students graduating in June can't apply).
     The student deadline is 2027-01-25, the supervisor deadline 2027-01-29.
   - NSERC USRA, applied for through the same portal.
   - a lab's "prospective students" page that matches their interests, found with web_search.
3. "listing" is program for UREX and USRA, lab for a lab page. These are programs and lab pages, not job openings.
   "opening_quote" quotes the lab page only if it explicitly posts an open undergraduate position.
4. "requirements" are the eligibility rules and the skills or courses the page asks for.
5. "next_step" is concrete: for a lab, read their recent papers and email asking for a short meeting; for a program, find a supervisor before the deadline, with the date.
   "question" asks whether they will still be an undergraduate next fall when that, or their GPA, is unknown.
${EXTRACTION_RULES}`,
    inputSchema: {
      type: "object",
      properties: { interest: { type: "string", maxLength: 200, description: "a research area they are curious about" } },
    },
    outputSchema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          maxItems: MAX_ITEMS,
          items: {
            type: "object",
            properties: {
              ...draftItemProperties,
              listing: { type: "string", enum: ["program", "lab"] },
              opening_quote: { type: "string", description: "word for word from the lab page, only if it posts an open position" },
            },
            required: [...draftItemRequired, "listing"],
          },
        },
      },
      required: ["items"],
    },
    buildGoal: (input) => `Recommend undergraduate research routes for this person.${input.interest ? ` They are curious about: ${input.interest}.` : ""}`,
    finalize: (output, toolCalls) => recommend((output as { items: ResearchDraft[] }).items, toolCalls, { readProfile, judge: judgeResearch }),
  };
}

export const recommendResearch = recommendResearchWith(readProfileFromToolCalls);
