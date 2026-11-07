import { agentCard } from "../core/card";
import { resumeSkills } from "./skills";

export const card = agentCard(
  { name: "resume", description: "Builds and keeps this person's profile: their skills, experience and goals, from what they say and upload." },
  resumeSkills,
);
