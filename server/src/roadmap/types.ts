export const STEP_KINDS = [
  "project",
  "interview_practice",
  // a real conversation to go and have, not an in-app chat: it only gets "Mark done"
  "networking_practice",
  "event",
  "course",
  "application",
  "certification",
  "volunteering",
  // opens Crossroads: what everyone on the same road learned; every road gets it once
  "explore_memory",
] as const;
export type StepKind = (typeof STEP_KINDS)[number];

export const STEP_STATUSES = ["todo", "started", "done", "skipped"] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];

export type StepLabel = "ready_now" | "stretch" | "long_term";

// what the app launches when the person taps the step's button
export type StepAction = { type: "interview"; companySlug?: string; role?: string; postingId?: string } | { type: "crossroads" };

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
// how a done step got done when the person didn't tick it themselves; "resume" steps never count toward a streak
export type CompletedVia = "resume";

export type Step = Omit<StepContent, "note"> & {
  id: string;
  status: StepStatus;
  completedAt: string | null;
  // always set by the store; optional so hand-built steps in tests needn't spell it out
  completedVia?: CompletedVia | null;
  note: string | null;
  source: StepSource;
  // set on a page when at least three people who reached a job took a step of this kind
  travelled?: { people: number; reached: string };
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
