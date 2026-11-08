import type { StepKind } from "../types";

export type Field = "tech" | "business" | "creative" | "health" | "general";

// what the templates know about the person: enough to name their goal and lean on a skill they already have
// headStart: they've already built or worked on something, so the plan skips a starter project
export type Person = { goal: string; skills: string[]; field: Field; headStart?: boolean };

export type TemplateStep = {
  kind: StepKind;
  title: (p: Person) => string;
  why: (p: Person) => string;
  detail: (p: Person) => string;
  estimate: string;
  // skills the step leans on; the label comes from how many the person already has
  needs: string[];
};

// the skill most worth building on: the first one listed, or a field-appropriate stand-in
export const lead = (p: Person, fallback: string) => p.skills[0] ?? fallback;
