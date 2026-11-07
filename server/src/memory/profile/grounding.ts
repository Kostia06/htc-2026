import type { ProfileSkill } from "./types";

const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();

// a resume claim survives only if its evidence is a real quote from the document it came from
export function keepGroundedSkills(skills: ProfileSkill[], sourceText: string) {
  const source = normalize(sourceText);
  const kept = skills.filter((s) => s.source !== "resume" || (s.evidence !== undefined && source.includes(normalize(s.evidence))));
  return { kept, dropped: skills.length - kept.length };
}
