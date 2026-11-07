import { draftItemProperties, draftItemRequired, EXTRACTION_RULES, MAX_ITEMS } from "../../recommend/draft-schema";
import { readProfileFromToolCalls, type ProfileReader } from "../../recommend/profile";
import { recommend, type DraftItem, type Judge } from "../../recommend/recommend";
import { assessFit } from "../../recommend/rubric";
import { containsQuote } from "../../recommend/verify";
import type { Skill } from "../core/types";

type Antirequisite = { quote: string; evidence?: string };
type CourseDraft = DraftItem & { antirequisites: Antirequisite[] };

const SAME_LEVEL = { role: 0, person: 0 };

// credit for an antirequisite already taken means the course can't count, whatever else fits
const judgeCourse: Judge<CourseDraft> = (draft, { requirements, source, profile }) => {
  const taken = draft.antirequisites.find((a) => containsQuote(source, a.quote) && a.evidence !== undefined && containsQuote(profile.text, a.evidence));
  if (taken) return { notAFit: `You already have ${taken.evidence}, and the calendar says "${taken.quote}" (antirequisite).` };
  return { assessment: assessFit({ requirements, experienceGapYears: 0, jobZone: SAME_LEVEL, separatesRequired: true }) };
};

export function recommendCoursesWith(readProfile: ProfileReader): Skill<{ interest?: string }> {
  return {
    name: "recommend-courses",
    description: "Recommend University of Calgary courses, checked against their prerequisites and antirequisites.",
    platforms: ["app"],
    personal: true,
    tools: ["profile", "recall", "web_search", "fetch_page"],
    maxSteps: 12,
    instructions: `Recommend up to ${MAX_ITEMS} University of Calgary courses that move this person toward their goals.
1. Call profile for their transcript and goals, then recall for kinds goal and skill.
2. Find courses with web_search, then fetch_page each course page from the current calendar (calendar.ucalgary.ca/courses/<id>).
3. "requirements" are the course's prerequisites, one per group as the calendar writes it, all with kind required.
   met is yes when the transcript shows a course from that group completed or in progress, quoted as evidence.
4. "antirequisites" quote each antirequisite line; "evidence" quotes the transcript when they already took that course.
5. "next_step" says which term to take it, or which prerequisite to take first next term.
   "path" is the prerequisite chain term by term. "question" asks for their transcript when it is missing.
${EXTRACTION_RULES}`,
    inputSchema: {
      type: "object",
      properties: { interest: { type: "string", maxLength: 200, description: "a topic or goal to pick courses for" } },
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
              antirequisites: {
                type: "array",
                maxItems: 10,
                items: { type: "object", properties: { quote: { type: "string" }, evidence: { type: "string" } }, required: ["quote"] },
              },
            },
            required: [...draftItemRequired, "antirequisites"],
          },
        },
      },
      required: ["items"],
    },
    buildGoal: (input) => `Recommend University of Calgary courses for this person.${input.interest ? ` They are interested in: ${input.interest}.` : ""}`,
    finalize: (output, toolCalls) => recommend((output as { items: CourseDraft[] }).items, toolCalls, { readProfile, judge: judgeCourse }),
  };
}

export const recommendCourses = recommendCoursesWith(readProfileFromToolCalls);
