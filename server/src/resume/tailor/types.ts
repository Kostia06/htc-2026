import type { Resume } from "../types";

export type TailorSection = "summary" | "experience" | "projects" | "skills";
export type ChangeKind = "reword" | "trim" | "reorder";

/** One edit made for the job, kept so the person can see it, and accept or revert it. */
export type TailorChange = {
  id: string;
  kind: ChangeKind;
  section: TailorSection;
  /** the base-resume path the change is grounded in, e.g. experience[0].bullets[1]; "skills" for the skills list */
  basedOn: string;
  before: string;
  /** empty for a trim */
  after: string;
  why: string;
  /** the posting requirement the change targets, in the posting's words; null only for a trim */
  requirement: string | null;
  accepted: boolean;
  /** the full new skills list, on the one skills change */
  skills?: string[];
};

export type RequirementRef = { text: string; topic: string; required: boolean };

/** Which of the posting's requirements the tailored resume now shows, and which it still can't. */
export type MatchSummary = { covered: RequirementRef[]; missing: RequirementRef[]; coveredBefore: number };

export type TailoredContent = {
  postingId: string;
  title: string;
  company: string;
  /** the base resume as it was when tailored, so a reverted change goes back to exactly what it replaced */
  base: Resume;
  resume: Resume;
  changes: TailorChange[];
  match: MatchSummary;
  /** once edited by hand, the change log is history: toggling a change would undo those edits */
  editedByHand: boolean;
};

export type TailoredResume = TailoredContent & { id: string; createdAt: string; updatedAt: string };

export type TailoredListItem = {
  id: string;
  postingId: string;
  title: string;
  company: string;
  covered: number;
  total: number;
  updatedAt: string;
};
