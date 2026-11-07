export const VOICE_MODES = ["interview", "networking"] as const;
export type VoiceMode = (typeof VOICE_MODES)[number];

export type QuestionSource = "reported" | "resume" | "behavioral";
export type PlannedQuestion = { text: string; source: QuestionSource; reportedIn?: string | null };

export type InterviewPlan = {
  mode: "interview";
  role: string;
  company: string | null;
  questions: PlannedQuestion[];
};

export type Persona = { name: string; role: string; company: string | null };

export type NetworkingPlan = {
  mode: "networking";
  role: string;
  persona: Persona;
  talkingPoints: string[];
  goals: string[];
};

export type VoicePlan = InterviewPlan | NetworkingPlan;
