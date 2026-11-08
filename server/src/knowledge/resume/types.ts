// Curated resume-writing guidance Skillit wrote from widely published recruiter and ATS advice; general examples,
// never anyone's real resume.
import type { Field } from "../interview/types";

export type { Field };

export const STAGES = ["student", "new_grad", "career_changer", "experienced", "returning", "apprentice", "newcomer"] as const;
export type Stage = (typeof STAGES)[number];

// pattern is the shape of a strong bullet; example fills it in with [add number] wherever a figure belongs
export type BulletPattern = { pattern: string; example: string };

export type SectionOrder = { stage: Stage; order: string[]; note: string };
export type Rule = { rule: string; why: string };
export type VerbGroup = { group: string; verbs: string[] };
