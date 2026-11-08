import type { StepContent } from "../types";

export type Field = "tech" | "business" | "creative" | "health" | "general";

export type TemplateStep = Omit<StepContent, "id" | "why"> & { why: (goal: string) => string };
export type TemplateUnit = { title: string; summary: string; steps: TemplateStep[] };
