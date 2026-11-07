import type { Skill } from "../../core/types";
import { onboardingPrefill } from "./onboarding-prefill";
import { profileIntake } from "./profile-intake";

export const resumeSkills: Skill[] = [profileIntake, onboardingPrefill];
