import type { Skill } from "../../core/types";

export const careerSnapshot: Skill<{ companies?: string[] }> = {
  name: "career-snapshot",
  description: "Suggest roles to aim for and the next steps to get there, from this person's goals and skills.",
  platforms: ["app"],
  personal: true,
  // labour market data (the occupations and postings tables) isn't loaded yet; once it is, add a
  // labour_outlook tool here and a step below telling the model to weigh roles by local outlook
  tools: ["recall", "company_insights"],
  maxSteps: 8,
  instructions: `Give this person a short career snapshot: which roles to aim for and what to do next.
1. Call recall for kinds goal and skill, then weakness.
2. For each company listed in the goal, call company_insights with its slug to see what they hire for and ask about.
3. "targetRoles" is one to three role titles that fit their goals and skills.
4. "nextSteps" is up to five concrete steps, each with why, tied to what you know about this person.
If you know too little about them, make the first step to tell you their career goal.`,
  inputSchema: {
    type: "object",
    properties: {
      companies: { type: "array", maxItems: 5, items: { type: "string", maxLength: 100 }, description: "slugs of companies they are interested in" },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      targetRoles: { type: "array", minItems: 1, maxItems: 3, items: { type: "string" } },
      nextSteps: {
        type: "array",
        maxItems: 5,
        items: { type: "object", properties: { step: { type: "string" }, why: { type: "string" } }, required: ["step", "why"] },
      },
    },
    required: ["targetRoles", "nextSteps"],
  },
  buildGoal: (input) => {
    const companies = input.companies?.length ? ` They are interested in these companies: ${input.companies.join(", ")}.` : "";
    return `Write a career snapshot for this person.${companies}`;
  },
};
