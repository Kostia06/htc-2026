import type { Skill } from "../core/types";
import { careerSnapshot } from "./career-snapshot";
import { interviewDebrief } from "./interview-debrief";
import { interviewIntel } from "./interview-intel";
import { interviewPrep } from "./interview-prep";
import { profileIntake } from "./profile-intake";
import { recommendCourses } from "./recommend-courses";
import { recommendJobs } from "./recommend-jobs";
import { recommendResearch } from "./recommend-research";
import { researchCompany } from "./research-company";

export const skills: Record<string, Skill> = Object.fromEntries(
  [researchCompany, interviewPrep, interviewDebrief, careerSnapshot, profileIntake, recommendJobs, recommendCourses, recommendResearch, interviewIntel].map((s) => [s.name, s]),
);
