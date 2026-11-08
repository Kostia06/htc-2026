import type { UnitContent } from "../types";
import { businessUnits } from "./business";
import { creativeUnits } from "./creative";
import { generalUnits, momentumUnits } from "./general";
import { healthUnits } from "./health";
import { techUnits } from "./tech";
import type { Field, TemplateUnit } from "./types";

// checked in order: "UX designer" is creative before it is tech, "health data analyst" is health
const FIELD_PATTERNS: [Field, RegExp][] = [
  ["health", /nurs|health|medic|clinic|pharma|therap|dental|doctor|physician|paramedic|care aide|caregiver/i],
  ["creative", /design|artist|\bart\b|illustrat|animat|music|film|photo|writer|creative|video|game art/i],
  ["tech", /software|develop|engineer|\bdata\b|programm|comput|cyber|security|devops|\bweb\b|cloud|machine learning|\bai\b|\bit\b|\bqa\b/i],
  ["business", /market|sales|account|financ|business|consult|manag|operations|human resources|\bhr\b|product|bank|analyst|recruit/i],
];

const UNITS: Record<Field, TemplateUnit[]> = {
  tech: techUnits,
  business: businessUnits,
  creative: creativeUnits,
  health: healthUnits,
  general: generalUnits,
};

export function detectField(goal: string): Field {
  return FIELD_PATTERNS.find(([, pattern]) => pattern.test(goal))?.[0] ?? "general";
}

// the deterministic fallback: same goal and index, same steps, so the path is never empty
export function templateUnit(goal: string, index: number): UnitContent {
  const own = UNITS[detectField(goal)];
  const extra = index - own.length;
  const unit = extra < 0 ? own[index] : momentumUnits[extra % momentumUnits.length];
  const round = extra < momentumUnits.length ? "" : ` · round ${Math.floor(extra / momentumUnits.length) + 1}`;
  return {
    title: `${unit.title}${round}`,
    summary: unit.summary,
    source: "template",
    steps: unit.steps.map(({ why, ...step }) => ({ ...step, id: `st_${crypto.randomUUID()}`, why: why(goal) })),
  };
}
