import type { StepContent, StepLabel } from "../types";
import { businessSteps } from "./business";
import { creativeSteps } from "./creative";
import { generalSteps, momentumSteps } from "./general";
import { healthSteps } from "./health";
import { techSteps } from "./tech";
import type { Field, Person, TemplateStep } from "./types";

export type { Field, Person } from "./types";

// checked in order: "UX designer" is creative before it is tech, "health data analyst" is health
const FIELD_PATTERNS: [Field, RegExp][] = [
  ["health", /nurs|health|medic|clinic|pharma|therap|dental|doctor|physician|paramedic|care aide|caregiver/i],
  ["creative", /design|artist|\bart\b|illustrat|animat|music|film|photo|writer|creative|video|game art/i],
  ["tech", /software|develop|engineer|\bdata\b|programm|comput|cyber|security|devops|\bweb\b|cloud|machine learning|\bai\b|\bit\b|\bqa\b/i],
  ["business", /market|sales|account|financ|business|consult|manag|operations|human resources|\bhr\b|product|bank|analyst|recruit/i],
];

const STEPS: Record<Field, TemplateStep[]> = {
  tech: techSteps,
  business: businessSteps,
  creative: creativeSteps,
  health: healthSteps,
  general: generalSteps,
};

export function detectField(goal: string): Field {
  return FIELD_PATTERNS.find(([, pattern]) => pattern.test(goal))?.[0] ?? "general";
}

export function personFor(goal: string, skills: string[]): Person {
  return { goal, skills, field: detectField(goal) };
}

// the deterministic, instant plan: positions `from` onward, the same for the same person, and never running out
export function templateSteps(person: Person, from: number, count: number): StepContent[] {
  return Array.from({ length: count }, (_, i) => fill(templateAt(person.field, from + i), person));
}

function templateAt(field: Field, position: number): TemplateStep {
  const own = STEPS[field];
  return position < own.length ? own[position] : momentumSteps[(position - own.length) % momentumSteps.length];
}

function fill(template: TemplateStep, person: Person): StepContent {
  const step: StepContent = {
    kind: template.kind,
    title: template.title(person),
    why: template.why(person),
    detail: template.detail(person),
    estimate: template.estimate,
    label: labelFor(template.needs, person.skills),
  };
  if (template.kind === "interview_practice") step.action = { type: "interview", role: person.goal };
  return step;
}

// a need counts as met when any of the person's skills mentions it
function labelFor(needs: string[], skills: string[]): StepLabel {
  const have = skills.map((s) => s.toLowerCase());
  const missing = needs.filter((need) => !have.some((skill) => skill.includes(need.toLowerCase()))).length;
  if (missing === 0) return "ready_now";
  return missing === 1 ? "stretch" : "long_term";
}
