import { agentCard } from "../core/card";
import { interviewSkills } from "./skills";

export const card = agentCard(
  { name: "interview", description: "Gets this person ready for interviews, and turns each practice session into a debrief." },
  interviewSkills,
);
