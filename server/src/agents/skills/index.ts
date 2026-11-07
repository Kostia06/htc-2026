import type { Skill } from "../core/types";
import { careerSnapshot } from "../career/skills/career-snapshot";
import { interviewDebrief } from "../interview/skills/interview-debrief";
import { interviewIntel } from "../interview/skills/interview-intel";
import { interviewPrep } from "../interview/skills/interview-prep";
import { networkingRecap } from "../interview/skills/networking-recap";
import { onboardingPrefill } from "../resume/skills/onboarding-prefill";
import { profileIntake } from "../resume/skills/profile-intake";
import { recommendCourses } from "../career/skills/recommend-courses";
import { recommendJobs } from "../career/skills/recommend-jobs";
import { recommendResearch } from "../career/skills/recommend-research";
import { researchCompany } from "../research/skills/research-company";

export const skills: Record<string, Skill> = Object.fromEntries(
  [researchCompany, interviewPrep, interviewDebrief, careerSnapshot, profileIntake, onboardingPrefill, recommendJobs, recommendCourses, recommendResearch, interviewIntel, networkingRecap].map((s) => [s.name, s]),
);
