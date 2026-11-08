import { STEP_KINDS } from "../../../roadmap/types";
import type { Skill } from "../../core/types";

export type RoadmapStepsInput = { goal: string; count: number; background?: string; previous?: string[] };

export const MAX_ROADMAP_STEPS = 10;

// no tools: the caller puts the profile in the goal, so one model call is enough and it runs after the response
export const roadmapSteps: Skill<RoadmapStepsInput> = {
  name: "roadmap-steps",
  description: "Write the next personal steps on this person's roadmap to their goal job, in any field.",
  platforms: ["app"],
  personal: true,
  tools: [],
  maxSteps: 3,
  instructions: `Write the next steps of a roadmap toward this person's goal job. They may be in any field: tech, business, art, health, trades, or not a student.
1. Call finish right away with exactly the number of "steps" asked for, in the order they should be done.
2. Each step is one concrete thing to do, with a "kind", a "title" under 60 characters starting with a verb, an "estimate" like "20 min" or "3 weeks",
   a "why": one line under 90 characters tied to something specific in their background or goal, and a "detail": one or two lines saying exactly what to do,
   naming their own skills, projects, school or employers where it fits.
3. Use interview_practice for a spoken mock interview and networking_practice for rehearsing a conversation; both are done in the app, so say what to rehearse.
4. Mix kinds that fit the field. Never repeat a step from "previous". Early steps are small and doable this week; later ones build toward applications.
5. "needs" lists 1 to 3 things the step requires of them, like a skill, tool, credential or contact. When their background shows it, quote the background word for word as "evidence";
   leave evidence out when it doesn't. Only a step anyone could do today has no needs.
Write plainly. Never promise an outcome.`,
  inputSchema: {
    type: "object",
    properties: {
      goal: { type: "string", minLength: 2, maxLength: 200, description: "the job they are working toward" },
      count: { type: "integer", description: "how many steps to write" },
      background: { type: "string", maxLength: 4000, description: "their profile as plain text" },
      previous: { type: "array", maxItems: 60, items: { type: "string", maxLength: 120 }, description: "titles of steps already on the roadmap" },
    },
    required: ["goal", "count"],
  },
  outputSchema: {
    type: "object",
    properties: {
      steps: {
        type: "array",
        minItems: 1,
        maxItems: MAX_ROADMAP_STEPS,
        items: {
          type: "object",
          properties: {
            kind: { type: "string", enum: [...STEP_KINDS] },
            title: { type: "string" },
            why: { type: "string" },
            detail: { type: "string" },
            estimate: { type: "string" },
            needs: {
              type: "array",
              maxItems: 3,
              items: { type: "object", properties: { need: { type: "string" }, evidence: { type: "string" } }, required: ["need"] },
            },
          },
          required: ["kind", "title", "why", "detail", "estimate", "needs"],
        },
      },
    },
    required: ["steps"],
  },
  buildGoal: (input) => {
    const previous = input.previous?.length ? `\nSteps already on their roadmap: ${input.previous.join("; ")}.` : "";
    const background = input.background ? `\nTheir background:\n${input.background}` : "\nTheir background is unknown; keep steps general for the field.";
    return `Write the next ${input.count} steps of the roadmap toward: ${input.goal}.${previous}${background}`;
  },
  groundingText: (input) => input.background ?? "",
};
