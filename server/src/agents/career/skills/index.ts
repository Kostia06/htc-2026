import type { Skill } from "../../core/types";
import { careerSnapshot } from "./career-snapshot";
import { recommendCourses } from "./recommend-courses";
import { recommendJobs } from "./recommend-jobs";
import { recommendResearch } from "./recommend-research";
import { roadmapUnit } from "./roadmap-unit";

export const careerSkills: Skill[] = [careerSnapshot, recommendJobs, recommendCourses, recommendResearch, roadmapUnit];
