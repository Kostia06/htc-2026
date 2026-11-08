import { agentCard } from "../core/card";
import { researchSkills } from "./skills";

export const card = agentCard(
  { name: "research", description: "Keeps shared, public facts about employers current. Works for nobody in particular and never sees private memory." },
  researchSkills,
);
