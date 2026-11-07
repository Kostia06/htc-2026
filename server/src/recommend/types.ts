export type Level = "ready_now" | "stretch" | "long_term" | "cant_tell";
export const LEVEL_ORDER: readonly Level[] = ["ready_now", "stretch", "cant_tell", "long_term"];

// hard: a gate like a licence, enrolment, GPA or graduation timing; one unmet gate rules out applying now
export type RequirementKind = "required" | "preferred" | "hard";
export type Met = "yes" | "no" | "unknown";

// quote is verbatim from the posting or course page, evidence verbatim from the person's profile
export type Requirement = { quote: string; kind: RequirementKind; met: Met; evidence?: string };

export type Gap = { requirement: string; kind: RequirementKind };
export type Match = { requirement: string; evidence: string };

export type Counts = {
  required_met: number;
  required_total: number;
  preferred_met: number;
  preferred_total: number;
  summary: string;
};

export type Assessment = {
  level: Level;
  reasons: string[];
  counts: Counts;
  matched: Match[];
  missing: Gap[];
  unknown: Gap[];
};
