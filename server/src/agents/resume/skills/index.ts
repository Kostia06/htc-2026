import type { Skill } from "../../core/types";
import { onboardingPrefill } from "./onboarding-prefill";
import { profileIntake } from "./profile-intake";
import { resumeCoach } from "./resume-coach";

export const resumeSkills: Skill[] = [profileIntake, onboardingPrefill, resumeCoach as Skill];
