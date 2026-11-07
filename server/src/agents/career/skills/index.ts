import type { Skill } from "../../core/types";
import { careerSnapshot } from "./career-snapshot";
import { recommendCourses } from "./recommend-courses";
import { recommendJobs } from "./recommend-jobs";
import { recommendResearch } from "./recommend-research";

export const careerSkills: Skill[] = [careerSnapshot, recommendJobs, recommendCourses, recommendResearch];
