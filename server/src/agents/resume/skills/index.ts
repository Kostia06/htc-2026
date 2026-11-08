import type { Skill } from "../../core/types";
import { githubProjects } from "./github-projects";
import { linkedinReview } from "./linkedin-review";
import { onboardingPrefill } from "./onboarding-prefill";
import { profileIntake } from "./profile-intake";
import { resumeCoach } from "./resume-coach";
import { resumeTailor } from "./resume-tailor";

export const resumeSkills: Skill[] = [profileIntake, onboardingPrefill, resumeCoach as Skill, resumeTailor as Skill, githubProjects as Skill, linkedinReview as Skill];
