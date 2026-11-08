import { matchingRole, mentions } from "./match";
import type { Candidate, FeedCriteria, FeedField } from "./types";

// what postings for each target role say, read from the jobs in this same build, so "jobs ask for" is never a guess
export type RoleDemand = { role: string; postings: string[] }[];

// curated course tags that name a format or a source rather than something the course teaches
const NOT_TAUGHT = new Set(["certificate", "beginner", "free", "library", "linkedin learning", "learning", "data", "web"]);
const ACRONYMS = new Set(["ai", "crm", "css", "html", "it", "mcat", "seo", "sql", "ui", "ux", "bi"]);

const display = (tag: string) => tag.split(" ").map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(" ");
const listed = (names: string[]) => (names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

export function roleDemand(candidates: Candidate[], criteria: FeedCriteria): RoleDemand {
  const jobs = candidates.filter((c) => c.card.kind === "job");
  return criteria.roles.map((role) => ({ role, postings: jobs.filter((j) => matchingRole(j.card.title, [role]) === role).map((j) => j.text) }));
}

// one-letter tags such as "c" or "r" would match "C-suite" or "R&D" in a posting, so they never back a claim
const topicsOf = (candidate: Candidate) => (candidate.card.tags ?? []).filter((t) => t.length > 1 && !NOT_TAUGHT.has(t));

// a course is about what it teaches: a skill the goal's postings ask for, one in the goal's field, or one the person builds on.
// The topics are the hand-checked curated tags, so nothing here says more about the course than its listing does
export function learningReasons(candidate: Candidate, criteria: FeedCriteria, demand: RoleDemand, field?: FeedField): string[] {
  if (candidate.card.kind !== "course") return [];
  const topics = topicsOf(candidate);
  const ownSkill = (topic: string) => criteria.skills.find((s) => s.toLowerCase() === topic);
  const fresh = topics.filter((t) => !ownSkill(t));
  const builtOn = topics.map(ownSkill).filter((s): s is string => s !== undefined).slice(0, 2);

  const asked = fresh.flatMap((topic) => demand.filter((d) => d.postings.some((p) => mentions(p, topic))).map((d) => ({ topic, role: d.role })))[0];
  const goal = criteria.roles[0];
  return [
    asked ? `Teaches ${display(asked.topic)}, which ${asked.role} jobs ask for` : undefined,
    !asked && goal && field && field !== "general" && fresh.length > 0 ? `Covers ${display(fresh[0])} for your ${goal} goal` : undefined,
    builtOn.length > 0 ? `Builds on your ${listed(builtOn)}` : undefined,
  ].filter((r): r is string => r !== undefined);
}
