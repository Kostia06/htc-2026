import { containsQuote } from "../../recommend/verify";
import type { Resume } from "../types";
import { BULLET_PATH, bulletsOf, resumeText } from "./paths";
import type { MatchSummary, RequirementRef, TailorChange } from "./types";

const asksFor = (requirement: RequirementRef, skill: string) =>
  containsQuote(requirement.topic, skill) || containsQuote(requirement.text, skill) || containsQuote(skill, requirement.topic);

/**
 * The one skills edit, made by code: skills the posting asks for go first, and a skill the profile lists but the
 * resume left out is added when the posting asks for it. Nothing outside the resume and profile can appear.
 */
export function skillsChange(base: Resume, requirements: RequirementRef[], profileSkills: string[], id: string): TailorChange | null {
  const relevant = (skill: string) => requirements.some((r) => asksFor(r, skill));
  const listed = new Set(base.skills.map((s) => s.toLowerCase()));
  const front = base.skills.filter(relevant);
  const added = [...new Set(profileSkills.map((s) => s.trim()).filter((s) => s && !listed.has(s.toLowerCase()) && relevant(s)))];
  const skills = [...front, ...added, ...base.skills.filter((s) => !relevant(s))];
  if (skills.join("\n") === base.skills.join("\n")) return null;

  const moved = [...front, ...added];
  const requirement = requirements.find((r) => moved.some((s) => asksFor(r, s)))!;
  const parts = [front.length > 0 && `Moves ${front.join(", ")} to the front`, added.length > 0 && `adds ${added.join(", ")} from your profile`].filter(Boolean);
  const why = `${parts.join(" and ")}, since the posting asks for ${moved.length === 1 ? "it" : "them"}.`;
  return {
    id, kind: "reorder", section: "skills", basedOn: "skills",
    before: base.skills.join(", "), after: skills.join(", "),
    why: why.charAt(0).toUpperCase() + why.slice(1), requirement: requirement.text, accepted: true, skills,
  };
}

/** The tailored resume is always the base with the accepted changes applied, so reverting one is exact. */
export function applyChanges(base: Resume, changes: TailorChange[]): Resume {
  const resume = structuredClone(base);
  const accepted = changes.filter((c) => c.accepted);
  for (const change of accepted) {
    if (change.kind === "reorder" && change.skills) resume.skills = [...change.skills];
    if (change.kind !== "reword") continue;
    if (change.basedOn === "summary") resume.summary = change.after;
    const bullet = BULLET_PATH.exec(change.basedOn);
    if (bullet) bulletsOf(resume, bullet[1], Number(bullet[2]))[Number(bullet[3])] = change.after;
  }
  // after the rewords, which point at the base's positions: dropping a bullet first would shift them
  const trimmed = new Set(accepted.filter((c) => c.kind === "trim").map((c) => c.basedOn));
  resume.experience.forEach((e, i) => (e.bullets = e.bullets.filter((_, j) => !trimmed.has(`experience[${i}].bullets[${j}]`))));
  resume.projects.forEach((p, i) => (p.bullets = p.bullets.filter((_, j) => !trimmed.has(`projects[${i}].bullets[${j}]`))));
  return resume;
}

const ref = ({ text, topic, required }: RequirementRef): RequirementRef => ({ text, topic, required });
const shows = (text: string, r: RequirementRef) => containsQuote(text, r.topic) || containsQuote(text, r.text);

export function matchSummary(base: Resume, resume: Resume, requirements: RequirementRef[]): MatchSummary {
  const now = resumeText(resume);
  const before = resumeText(base);
  return {
    covered: requirements.filter((r) => shows(now, r)).map(ref),
    missing: requirements.filter((r) => !shows(now, r)).map(ref),
    coveredBefore: requirements.filter((r) => shows(before, r)).length,
  };
}
