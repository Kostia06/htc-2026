import type { Experience, Profile, Project } from "../memory/profile/types";
import { fieldsOf } from "./fields";
import type { FeedCriteria, PastWork } from "./types";

const MAX_ROLES = 3;
const MAX_SKILLS = 12;
const MAX_WORK = 6;
const MIN_WORK_WORD = 4;

// words that describe almost any project or job, so an overlap on them says nothing
const FILLER = new Set(
  "with from that this into over your their them they what when were have been also about built build building using used made make makes project projects team teams work worked working website system systems tool tools create created develop developed design designed implement implemented manage managed support supported help helped lead role roles company".split(
    " ",
  ),
);

// terms that show the person reaches for AI, in their skills, headline, goals, projects or experience
const AI_TERMS = /\b(ai|ml|llm|llms|gpt|chatgpt|copilot|claude|gemini|openai|langchain|cursor|machine learning|generative|genai|neural)\b/i;
// terms that place a person at the start of their career
const EARLY_TERMS = /\b(junior|intern|internship|entry[- ]level|student|students|new grad|graduate|graduating|first (job|role)|career change|switching careers|bootcamp)\b/i;

const wordsOf = (text: string) => text.toLowerCase().match(/[a-z0-9+#]+/g) ?? [];
const overlapWords = (text: string) => [...new Set(wordsOf(text).filter((w) => w.length >= MIN_WORK_WORD && !FILLER.has(w)))];

// the profile has no location field yet; a string one is used as soon as it does
function locationOf(profile: Profile) {
  const value = (profile as Profile & { location?: unknown }).location;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

const projectWork = (project: Project): PastWork => ({ label: `your ${project.name.trim()} project`, words: overlapWords(`${project.name} ${project.summary ?? ""}`) });
const experienceWork = (job: Experience): PastWork => ({ label: `your ${job.role.trim()} work`, words: overlapWords(`${job.role} ${(job.highlights ?? []).join(" ")}`) });

// projects first: they are what a person chose to build, so a match on one is the stronger story
function workOf(profile: Profile): PastWork[] {
  return [...profile.projects.filter((p) => p.name.trim()).map(projectWork), ...profile.experience.filter((e) => e.role.trim()).map(experienceWork)]
    .filter((w) => w.words.length > 0)
    .slice(0, MAX_WORK);
}

function isEarlyCareer(profile: Profile) {
  if (profile.experience.length === 0) return true;
  if (profile.education.some((e) => e.expectedGraduation)) return true;
  return EARLY_TERMS.test([profile.headline ?? "", ...profile.targetRoles, ...profile.goals, ...profile.education.map((e) => e.program ?? "")].join(" "));
}

function mentionsAI(profile: Profile) {
  const text = [
    profile.headline ?? "",
    ...profile.goals,
    ...profile.skills.map((s) => s.name),
    ...profile.projects.map((p) => `${p.name} ${p.summary ?? ""}`),
    ...profile.experience.flatMap((e) => e.highlights ?? []),
  ].join(" ");
  return AI_TERMS.test(text);
}

// target roles first; without them the most recent job title stands in, so a half-filled profile still gets a feed
export function criteriaFrom(profile: Profile, avoidTags: string[] = []): FeedCriteria {
  const roles = profile.targetRoles.length > 0 ? profile.targetRoles : profile.experience.slice(0, 1).map((e) => e.role);
  return {
    roles: roles.map((r) => r.trim()).filter(Boolean).slice(0, MAX_ROLES),
    skills: profile.skills.map((s) => s.name.trim()).filter(Boolean).slice(0, MAX_SKILLS),
    location: locationOf(profile),
    fields: fieldsOf(profile),
    avoidTags,
    work: workOf(profile),
    earlyCareer: isEarlyCareer(profile),
    usesAI: mentionsAI(profile),
  };
}

// one job search per role; with no roles, the top skills make one search so the feed is never empty for lack of a goal
export function jobQueries(criteria: FeedCriteria) {
  const terms = criteria.roles.length > 0 ? criteria.roles : criteria.skills.length > 0 ? [criteria.skills.slice(0, 2).join(" ")] : [];
  return terms.map((what) => ({ what, where: criteria.location }));
}
