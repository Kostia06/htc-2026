import type { Profile } from "../memory/profile/types";
import type { InterviewPlan, NetworkingPlan, PlannedQuestion } from "./types";

export const MAX_QUESTIONS = 6;
const MAX_REPORTED = 3;
const MAX_FROM_RESUME = 2;
const MAX_TALKING_POINTS = 5;

export type PlanInputs = {
  role: string;
  company: { id: string; slug: string; name: string } | null;
  // already filtered by the k=3 rule in getCompanyInsights, newest first
  reportedQuestions: { text: string; last_reported_at: string | null }[];
  facts: { kind: string; text: string }[];
  profile: Profile;
};

const behavioralQuestions = (role: string) => [
  `What draws you to the ${role} role?`,
  "Tell me about a time you had to learn something quickly. What did you do?",
  "Describe a time you disagreed with a teammate. How did you handle it?",
  "Tell me about a mistake you made and what you changed afterwards.",
  "Walk me through a project you're proud of, from start to finish.",
  "Where do you want to be in two years, and how does this role fit?",
];

// the resume's own words, so the person hears their claim back and has to stand behind it
function resumeQuestions(profile: Profile): PlannedQuestion[] {
  const fromExperience = profile.experience.flatMap((job) =>
    (job.highlights ?? []).map((line) => `Your resume says "${line}" at ${job.org}. What was your part, and how did it turn out?`),
  );
  const fromSkills = profile.skills
    .filter((skill) => skill.evidence)
    .map((skill) => `You wrote "${skill.evidence}". Walk me through how you used ${skill.name} there.`);
  return [...fromExperience, ...fromSkills].slice(0, MAX_FROM_RESUME).map((text) => ({ text, source: "resume" }));
}

export function buildInterviewPlan(inputs: PlanInputs): InterviewPlan {
  const reported: PlannedQuestion[] = inputs.reportedQuestions
    .slice(0, MAX_REPORTED)
    .map((q) => ({ text: q.text, source: "reported", reportedIn: q.last_reported_at }));
  const planned = [...reported, ...resumeQuestions(inputs.profile)];
  const behavioral = behavioralQuestions(inputs.role).map((text): PlannedQuestion => ({ text, source: "behavioral" }));
  const questions = [...planned, ...behavioral].slice(0, MAX_QUESTIONS);
  return { mode: "interview", role: inputs.role, company: inputs.company?.name ?? null, questions };
}

const MEETUP_TALKING_POINTS = [
  "How you got into your field and what you're working on now.",
  "Which local meetups and events are worth going to in Calgary.",
  "What the hiring market looks like for people starting out.",
  "A tool or skill you've picked up recently.",
];

const NETWORKING_GOALS = [
  "Introduce yourself in a sentence or two, with what you're aiming for.",
  "Ask at least one real question about their work.",
  "Ask for a way to follow up, like connecting online or a coffee chat.",
];

export function buildNetworkingPlan(inputs: PlanInputs): NetworkingPlan {
  const company = inputs.company;
  const persona = company
    ? { name: "Sam", role: `works on the team at ${company.name}`, company: company.name }
    : { name: "Sam", role: "works in tech in Calgary and comes to most meetups", company: null };
  const fromFacts = inputs.facts.filter((fact) => ["about", "news", "tech", "hiring"].includes(fact.kind)).map((fact) => fact.text);
  const talkingPoints = [...fromFacts, ...MEETUP_TALKING_POINTS].slice(0, MAX_TALKING_POINTS);
  return { mode: "networking", role: inputs.role, persona, talkingPoints, goals: NETWORKING_GOALS };
}
