import type { Skill } from "../core/types";
import { careerSnapshot } from "./career-snapshot";
import { interviewDebrief } from "./interview-debrief";
import { interviewPrep } from "./interview-prep";
import { profileIntake } from "./profile-intake";
import { researchCompany } from "./research-company";

export const skills: Record<string, Skill> = Object.fromEntries(
  [researchCompany, interviewPrep, interviewDebrief, careerSnapshot, profileIntake].map((s) => [s.name, s]),
);
