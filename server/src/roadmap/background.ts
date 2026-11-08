import type { Profile } from "../memory/profile/types";

const MAX_BACKGROUND = 4000;
export const NO_GOAL = "your next role";

export function goalOf(profile: Profile): string {
  return profile.targetRoles[0] ?? profile.goals[0] ?? NO_GOAL;
}

export function skillsOf(profile: Profile): string[] {
  return profile.skills.map((s) => s.name).filter(Boolean);
}

// plain lines the model can quote from; the same text checks its quotes when labels are decided
export function backgroundOf(profile: Profile): string {
  const lines = [
    profile.headline,
    profile.goals.length ? `Goals: ${profile.goals.join("; ")}` : undefined,
    ...profile.skills.map((s) => `Skill: ${s.name}${s.evidence ? ` (${s.evidence})` : ""}`),
    ...profile.education.map((e) => `Education: ${[e.program, e.school, e.year].filter(Boolean).join(", ")}`),
    ...profile.experience.map((e) => `Experience: ${e.role} at ${e.org}${e.highlights?.length ? `: ${e.highlights.join("; ")}` : ""}`),
    ...profile.projects.map((p) => `Project: ${p.name}${p.summary ? `: ${p.summary}` : ""}`),
    ...profile.certifications.map((c) => `Certification: ${c}`),
  ];
  return lines.filter(Boolean).join("\n").slice(0, MAX_BACKGROUND);
}
