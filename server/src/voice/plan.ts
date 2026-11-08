import type { Profile } from "../memory/profile/types";
import { isShortEnough, resumeQuestions } from "./resume-questions";
import { technicalQuestions } from "./technical";
import type { Difficulty, InterviewPlan, PlannedQuestion } from "./types";

export { MAX_WORDS } from "./resume-questions";

// short on purpose: five questions with a follow-up each is a ten-minute conversation
export const MAX_QUESTIONS = 5;
const MAX_FROM_RESUME = 2;
const MAX_FROM_POSTING = 2;
const MAX_REPORTED = 1;
const MAX_TECHNICAL = 2;

/** The posting the person is preparing for, when the session was started from one. */
export type PlanPosting = {
  requirements: { text: string; have: boolean }[];
  responsibilities: string[];
};

export type PlanInputs = {
  role: string;
  company: { id: string; slug: string; name: string } | null;
  // already filtered by the k=3 rule in getCompanyInsights, newest first
  reportedQuestions: { text: string; last_reported_at: string | null }[];
  facts: { kind: string; text: string }[];
  profile: Profile;
  difficulty?: Difficulty;
  posting?: PlanPosting;
};

const behavioralQuestions = (role: string) => [
  `So what draws you to the ${role} role?`,
  "Tell me about a time you had to learn something fast.",
  "Tell me about a time you disagreed with a teammate. What happened?",
  "What's a mistake you made, and what did you change after?",
  "What's a project you're really proud of?",
];

const unpunctuated = (text: string) => text.trim().replace(/[.;:]+$/, "");
// responsibilities are written as orders ("Build dashboards"), so they read on from "you'd" once the capital goes
const asVerbPhrase = (text: string) => unpunctuated(text).replace(/^[A-Z](?![A-Z])/, (c) => c.toLowerCase());

// what they'd do first, then what they bring, then the gap: an interviewer probes the posting's own words.
// A requirement opens its sentence, so "Kubernetes" and "Experience with SQL" both keep the case they were written in.
export function postingQuestions(posting: PlanPosting): string[] {
  return [
    ...posting.responsibilities.map((r) => `Here you'd ${asVerbPhrase(r)}. When have you done something like that?`),
    ...posting.requirements.filter((r) => r.have).map((r) => `${unpunctuated(r.text)} is on the posting. Where have you used it?`),
    ...posting.requirements.filter((r) => !r.have).map((r) => `${unpunctuated(r.text)} is on the posting. How would you get up to speed?`),
  ];
}

const planned = (texts: string[], source: PlannedQuestion["source"], max: number): PlannedQuestion[] =>
  texts.filter(isShortEnough).slice(0, max).map((text) => ({ text, source }));

// personal first, so it opens like a real conversation; then the posting, what others were asked, then their field
export function buildInterviewPlan(inputs: PlanInputs): InterviewPlan {
  const reported: PlannedQuestion[] = inputs.reportedQuestions
    .filter((q) => isShortEnough(q.text))
    .slice(0, MAX_REPORTED)
    .map((q) => ({ text: q.text, source: "reported", reportedIn: q.last_reported_at }));
  const questions = [
    ...planned(resumeQuestions(inputs.profile), "resume", MAX_FROM_RESUME),
    ...(inputs.posting ? planned(postingQuestions(inputs.posting), "posting", MAX_FROM_POSTING) : []),
    ...reported,
    ...planned(technicalQuestions(inputs.role, inputs.profile), "technical", MAX_TECHNICAL),
    ...planned(behavioralQuestions(inputs.role), "behavioral", MAX_QUESTIONS),
  ].slice(0, MAX_QUESTIONS);
  return { mode: "interview", role: inputs.role, difficulty: inputs.difficulty ?? "standard", company: inputs.company?.name ?? null, questions };
}
