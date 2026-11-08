// Curated example interview questions Skillit wrote from well-known public question patterns. They are examples,
// never reports from real candidates, and never count toward any "three people" threshold.
export const ROUNDS = ["phone_screen", "behavioural", "technical", "case", "situational", "portfolio", "practical", "panel"] as const;
export type Round = (typeof ROUNDS)[number];

// "shows" is what a strong answer demonstrates, in one sentence
export type BankQuestion = { round: Round; text: string; shows: string };

export const FIELDS = ["software", "data", "finance", "marketing", "design", "health", "trades", "education", "changer", "non_student"] as const;
export type Field = (typeof FIELDS)[number];

export type CompanyQuestionSet = { slugs: string[]; role: string; questions: BankQuestion[] };
