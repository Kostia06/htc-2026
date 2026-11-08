export const STEP_KINDS = [
  "project",
  "course",
  "hackathon",
  "event",
  "networking",
  "certification",
  "volunteering",
  "application",
  "interview_practice",
] as const;
export type StepKind = (typeof STEP_KINDS)[number];

export const STEP_STATUSES = ["todo", "started", "done", "skipped"] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];

export type StepLabel = "ready_now" | "stretch" | "long_term";

export type StepContent = { id: string; kind: StepKind; title: string; why: string; label: StepLabel; estimate: string };
export type Step = StepContent & { status: StepStatus };

// what gets encrypted and stored for one unit
export type UnitContent = { title: string; summary: string; source: "agent" | "template"; steps: StepContent[] };
export type Unit = Omit<UnitContent, "steps"> & { index: number; steps: Step[] };

export type RoadmapPage = {
  goal: string;
  summary: { done: number; total: number; thisWeek: number };
  units: Unit[];
  nextCursor: string | null;
};

export const isStepStatus = (value: unknown): value is StepStatus => STEP_STATUSES.includes(value as StepStatus);
