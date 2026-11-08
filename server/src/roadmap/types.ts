export const STEP_KINDS = [
  "project",
  "interview_practice",
  "networking_practice",
  "event",
  "course",
  "application",
  "certification",
  "volunteering",
] as const;
export type StepKind = (typeof STEP_KINDS)[number];

export const STEP_STATUSES = ["todo", "started", "done", "skipped"] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];

export type StepLabel = "ready_now" | "stretch" | "long_term";

// what the app launches when the person taps the step's button
export type StepAction = { type: "interview" | "networking"; companySlug?: string; role?: string };

// what gets encrypted and stored for one step: the text, plus the person's own note once they finish it
export type StepContent = {
  kind: StepKind;
  title: string;
  why: string;
  detail: string;
  estimate: string;
  label: StepLabel;
  action?: StepAction;
  note?: string;
};

export type StepSource = "template" | "agent";

export type Step = Omit<StepContent, "note"> & {
  id: string;
  status: StepStatus;
  completedAt: string | null;
  note: string | null;
  source: StepSource;
};

export type Progress = { done: number; total: number; streakDays: number };
export type CompletedDay = { day: string; steps: Step[] };

export type RoadmapPage = {
  goal: string;
  progress: Progress;
  next: Step[];
  nextCursor: string | null;
  completed: CompletedDay[];
};

export const isStepStatus = (value: unknown): value is StepStatus => STEP_STATUSES.includes(value as StepStatus);
export const isOpen = (status: StepStatus) => status === "todo" || status === "started";
