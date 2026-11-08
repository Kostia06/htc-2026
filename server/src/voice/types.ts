// still a list so the API keeps its `mode` field; interview is the only practice left
export const VOICE_MODES = ["interview"] as const;
export type VoiceMode = (typeof VOICE_MODES)[number];

export const DIFFICULTIES = ["easy", "standard", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export type QuestionSource = "reported" | "resume" | "posting" | "technical" | "behavioral";
export type PlannedQuestion = { text: string; source: QuestionSource; reportedIn?: string | null };

export type InterviewPlan = {
  mode: "interview";
  role: string;
  difficulty?: Difficulty;
  company: string | null;
  questions: PlannedQuestion[];
};

export type VoicePlan = InterviewPlan;
