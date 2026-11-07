import { draftItemProperties, draftItemRequired, EXTRACTION_RULES, MAX_ITEMS } from "../../../recommend/draft-schema";
import { readProfileFromToolCalls, type ProfileReader } from "../../../recommend/profile";
import { recommend, type DraftItem, type Judge } from "../../../recommend/recommend";
import { assessFit, experienceGap } from "../../../recommend/rubric";
import { containsQuote } from "../../../recommend/verify";
import type { Skill } from "../../core/types";

type Experience = { quote: string; kind: "work" | "project"; years: number };
type Person = { job_zone: number; experience: Experience[] };
type JobDraft = DraftItem & { separates_required: boolean; job_zone: number; experience_required?: { years: number; quote: string } };

const judgeJob =
  (person: Person): Judge<JobDraft> =>
  (draft, { requirements, source, profile }) => {
    const shown = person.experience.filter((e) => containsQuote(profile.text, e.quote));
    const workYears = shown.filter((e) => e.kind === "work").reduce((sum, e) => sum + e.years, 0);
    const projects = shown.filter((e) => e.kind === "project").length;
    const stated = draft.experience_required;
    const requiredYears = stated && containsQuote(source, stated.quote) ? stated.years : 0;
    return {
      assessment: assessFit({
        requirements,
        experienceGapYears: experienceGap(requiredYears, { workYears, projects }),
        jobZone: { role: draft.job_zone, person: person.job_zone },
        separatesRequired: draft.separates_required,
      }),
    };
  };

const zone = { type: "integer", description: "O*NET Job Zone 1 to 5; 4 usually needs a bachelor's degree, 5 graduate school" } as const;

export function recommendJobsWith(readProfile: ProfileReader): Skill<{ query?: string }> {
  return {
    name: "recommend-jobs",
    description: "Recommend real job postings, each honestly labelled ready now, stretch, long term or can't tell yet.",
    platforms: ["app"],
    personal: true,
    tools: ["profile", "recall", "web_search", "fetch_page"],
    maxSteps: 12,
    instructions: `Recommend up to ${MAX_ITEMS} current job postings for this person, mostly in or near Calgary.
1. Call profile, then recall for kinds goal and skill.
2. Use web_search for postings that fit their goals, then fetch_page each posting you will recommend.
3. For each posting, list its requirements and whether this person meets each one.
   "separates_required" is false when the posting doesn't say which items are required and which are preferred.
   "experience_required" only when the posting states years, with the quote that states them.
   "job_zone" is the role's preparation level.
4. "person.job_zone" is this person's level now; a current undergraduate is at most 3.
   "person.experience" lists co-ops, internships and jobs (kind work, with years) and relevant projects (kind project), each quoted from the profile.
5. "next_step" is what to do to apply now. "path" is a concrete route if it is a long-term goal.
   "question" is the one question that would settle a requirement the profile is silent on.
${EXTRACTION_RULES}`,
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", maxLength: 200, description: "what kind of role they are looking for" } },
    },
    outputSchema: {
      type: "object",
      properties: {
        person: {
          type: "object",
          properties: {
            job_zone: zone,
            experience: {
              type: "array",
              maxItems: 10,
              items: {
                type: "object",
                properties: { quote: { type: "string" }, kind: { type: "string", enum: ["work", "project"] }, years: { type: "number" } },
                required: ["quote", "kind", "years"],
              },
            },
          },
          required: ["job_zone", "experience"],
        },
        items: {
          type: "array",
          maxItems: MAX_ITEMS,
          items: {
            type: "object",
            properties: {
              ...draftItemProperties,
              separates_required: { type: "boolean" },
              job_zone: zone,
              experience_required: {
                type: "object",
                properties: { years: { type: "number" }, quote: { type: "string" } },
                required: ["years", "quote"],
              },
            },
            required: [...draftItemRequired, "separates_required", "job_zone"],
          },
        },
      },
      required: ["person", "items"],
    },
    buildGoal: (input) => `Recommend job postings for this person.${input.query ? ` They are looking for: ${input.query}.` : ""}`,
    finalize: (output, toolCalls) => {
      const { person, items } = output as { person: Person; items: JobDraft[] };
      return recommend(items, toolCalls, { readProfile, judge: judgeJob(person) });
    },
  };
}

export const recommendJobs = recommendJobsWith(readProfileFromToolCalls);
