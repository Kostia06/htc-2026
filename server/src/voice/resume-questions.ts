import type { Profile } from "../memory/profile/types";

export const MAX_WORDS = 20;

const PAST_TENSE = /^(?:\w+ed|built|led|ran|wrote|made|won|taught|grew|set up|began|took|gave|sold|found|brought|kept|held|drew|spoke)\b/i;
// a clipped phrase shouldn't end on a word that promises more
const DANGLING = new Set(["a", "an", "the", "and", "or", "of", "to", "for", "with", "that", "in", "on", "at", "by", "from", "which"]);

const wordsOf = (text: string) => text.split(/\s+/).filter(Boolean);
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const article = (noun: string) => (/^[aeiou]/i.test(noun) ? "an" : "a");

function clip(text: string, maxWords: number) {
  const words = wordsOf(text.replace(/[.!;:]+$/, "")).slice(0, Math.max(maxWords, 1));
  while (words.length > 1 && DANGLING.has((words.at(-1) ?? "").toLowerCase())) words.pop();
  return words.join(" ");
}

// "I saw you <did something> at <org>. <tail>", shortened to stay under the spoken limit
function sawYou(deed: string, org: string | undefined, tail: string) {
  const where = org ? ` at ${org}` : "";
  const budget = MAX_WORDS - wordsOf(`I saw${where}. ${tail}`).length;
  const what = PAST_TENSE.test(deed) ? `you ${lowerFirst(deed)}` : `your work on ${lowerFirst(deed)}`;
  return `I saw ${clip(what, budget)}${where}. ${tail}`;
}

function fromRole(role: string, org: string) {
  if (/research/i.test(role)) return `I saw you did research for ${org}. Could you tell me about that?`;
  return `I saw you were ${article(role)} ${role} at ${org}. What did you work on?`;
}

/** The person's own resume, said back the way an interviewer who skimmed it would: "I saw you ... tell me about it." */
export function resumeQuestions(profile: Profile): string[] {
  const highlights = profile.experience.flatMap((job) => (job.highlights ?? []).slice(0, 1).map((line) => sawYou(line, job.org, "Tell me about it.")));
  const roles = profile.experience.filter((job) => !job.highlights?.length).map((job) => fromRole(job.role, job.org));
  const projects = profile.projects.map((project) => `I saw your project ${project.name}. What was the hardest part?`);
  const skills = profile.skills.flatMap((skill) => (skill.evidence ? [sawYou(skill.evidence, undefined, "How did that go?")] : []));
  return [...highlights, ...roles, ...projects, ...skills];
}

export const isShortEnough = (text: string) => wordsOf(text).length <= MAX_WORDS;
