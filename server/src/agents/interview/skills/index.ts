import type { Skill } from "../../core/types";
import { interviewDebrief } from "./interview-debrief";
import { interviewIntel } from "./interview-intel";
import { interviewPrep } from "./interview-prep";
import { interviewRecap } from "./interview-recap";

export const interviewSkills: Skill[] = [interviewPrep, interviewIntel, interviewDebrief, interviewRecap];
