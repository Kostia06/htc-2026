import { agentCard } from "../core/card";
import { careerSkills } from "./skills";

export const card = agentCard(
  { name: "career", description: "Says where this person stands and what to do next: roles to aim for, and jobs, courses and research that fit." },
  careerSkills,
);
