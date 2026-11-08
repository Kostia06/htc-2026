import { STEP_KINDS } from "../../../roadmap/types";
import type { Skill } from "../../core/types";

export type RoadmapUnitInput = { goal: string; unit: number; background?: string; previous?: string[] };

export const MAX_UNIT_STEPS = 5;

// no tools: the caller puts the profile in the goal, so one model call is enough and the first unit is fast
export const roadmapUnit: Skill<RoadmapUnitInput> = {
  name: "roadmap-unit",
  description: "Plan the next unit of steps on this person's roadmap to their goal job, in any field.",
  platforms: ["app"],
  personal: true,
  tools: [],
  maxSteps: 3,
  instructions: `Plan one unit of a step-by-step roadmap toward this person's goal job. They may be in any field: tech, business, art, health, trades, or not a student.
1. Call finish right away with one unit: a short "title" (2-5 words), a one-line "summary", and 3 to ${MAX_UNIT_STEPS} ordered "steps".
2. Each step is one concrete thing to do next, with a "kind", a "title" under 60 characters starting with a verb, an "estimate" like "2 hours" or "3 weeks",
   and a "why": one line under 90 characters tied to something specific in their background or goal.
3. Mix kinds that fit the field: hackathons suit tech, juried shows suit art, volunteering suits health. Never repeat a step from "previous".
4. Early units are small, doable steps; later units build toward applications and interviews.
5. "needs" lists 1 to 3 things the step requires of them, like a skill, tool, credential or contact. When their background shows it, quote the background word for word as "evidence";
   leave evidence out when it doesn't. Only a step anyone could do today, like going to a meetup, has no needs.
Write plainly. Never promise an outcome.`,
  inputSchema: {
    type: "object",
    properties: {
      goal: { type: "string", minLength: 2, maxLength: 200, description: "the job they are working toward" },
      unit: { type: "integer", description: "which unit this is, starting at 0" },
      background: { type: "string", maxLength: 4000, description: "their profile as plain text" },
      previous: { type: "array", maxItems: 60, items: { type: "string", maxLength: 120 }, description: "titles of steps already on the roadmap" },
    },
    required: ["goal", "unit"],
  },
  outputSchema: {
    type: "object",
    properties: {
      title: { type: "string" },
      summary: { type: "string" },
      steps: {
        type: "array",
        minItems: 3,
        maxItems: MAX_UNIT_STEPS,
        items: {
          type: "object",
          properties: {
            kind: { type: "string", enum: [...STEP_KINDS] },
            title: { type: "string" },
            why: { type: "string" },
            estimate: { type: "string" },
            needs: {
              type: "array",
              maxItems: 3,
              items: { type: "object", properties: { need: { type: "string" }, evidence: { type: "string" } }, required: ["need"] },
            },
          },
          required: ["kind", "title", "why", "estimate", "needs"],
        },
      },
    },
    required: ["title", "summary", "steps"],
  },
  buildGoal: (input) => {
    const previous = input.previous?.length ? `\nSteps already on their roadmap: ${input.previous.join("; ")}.` : "";
    const background = input.background ? `\nTheir background:\n${input.background}` : "\nTheir background is unknown; keep steps general for the field.";
    return `Plan unit ${input.unit + 1} of the roadmap toward: ${input.goal}.${previous}${background}`;
  },
  groundingText: (input) => input.background ?? "",
};
