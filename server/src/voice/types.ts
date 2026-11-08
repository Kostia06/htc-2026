// still a list so the API keeps its `mode` field; interview is the only practice left
export const VOICE_MODES = ["interview"] as const;
export type VoiceMode = (typeof VOICE_MODES)[number];

export const DIFFICULTIES = ["easy", "standard", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

// quick is the one-minute taster: two questions, no follow-ups
export const LENGTHS = ["quick", "full"] as const;
export type InterviewLength = (typeof LENGTHS)[number];

export type QuestionSource = "reported" | "resume" | "posting" | "technical" | "behavioral";
export type PlannedQuestion = { text: string; source: QuestionSource; reportedIn?: string | null };

export type InterviewPlan = {
  mode: "interview";
  role: string;
  difficulty?: Difficulty;
  // absent on sessions saved before quick interviews existed, which were all full
  length?: InterviewLength;
  company: string | null;
  questions: PlannedQuestion[];
};

export type VoicePlan = InterviewPlan;
