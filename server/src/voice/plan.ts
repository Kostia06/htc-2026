import type { Profile } from "../memory/profile/types";
import { isShortEnough, resumeQuestions } from "./resume-questions";
import { technicalQuestions } from "./technical";
import type { Difficulty, InterviewPlan, NetworkingPlan, PlannedQuestion } from "./types";

export { MAX_WORDS } from "./resume-questions";

// short on purpose: five questions with a follow-up each is a ten-minute conversation
export const MAX_QUESTIONS = 5;
const MAX_FROM_RESUME = 2;
const MAX_REPORTED = 1;
const MAX_TECHNICAL = 2;
const MAX_TALKING_POINTS = 5;

export type PlanInputs = {
  role: string;
  company: { id: string; slug: string; name: string } | null;
  // already filtered by the k=3 rule in getCompanyInsights, newest first
  reportedQuestions: { text: string; last_reported_at: string | null }[];
  facts: { kind: string; text: string }[];
  profile: Profile;
  difficulty?: Difficulty;
};

const behavioralQuestions = (role: string) => [
  `So what draws you to the ${role} role?`,
  "Tell me about a time you had to learn something fast.",
  "Tell me about a time you disagreed with a teammate. What happened?",
  "What's a mistake you made, and what did you change after?",
  "What's a project you're really proud of?",
];

const planned = (texts: string[], source: PlannedQuestion["source"], max: number): PlannedQuestion[] =>
  texts.filter(isShortEnough).slice(0, max).map((text) => ({ text, source }));

// personal first, so it opens like a real conversation; then what others were asked, then their field
export function buildInterviewPlan(inputs: PlanInputs): InterviewPlan {
  const reported: PlannedQuestion[] = inputs.reportedQuestions
    .filter((q) => isShortEnough(q.text))
    .slice(0, MAX_REPORTED)
    .map((q) => ({ text: q.text, source: "reported", reportedIn: q.last_reported_at }));
  const questions = [
    ...planned(resumeQuestions(inputs.profile), "resume", MAX_FROM_RESUME),
    ...reported,
    ...planned(technicalQuestions(inputs.role, inputs.profile), "technical", MAX_TECHNICAL),
    ...planned(behavioralQuestions(inputs.role), "behavioral", MAX_QUESTIONS),
  ].slice(0, MAX_QUESTIONS);
  return { mode: "interview", role: inputs.role, difficulty: inputs.difficulty ?? "standard", company: inputs.company?.name ?? null, questions };
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
  return { mode: "networking", role: inputs.role, difficulty: inputs.difficulty ?? "standard", persona, talkingPoints, goals: NETWORKING_GOALS };
}
