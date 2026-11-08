import type { Profile } from "../memory/profile/types";

type Field = { pattern: RegExp; questions: [string, string] };

// order matters: "software engineer" is software, "financial analyst" is finance, before the broader patterns catch them
const FIELDS: Field[] = [
  {
    pattern: /\b(software|developer|programm\w*|web|front.?end|back.?end|full.?stack|devops|mobile|ios|android|computer science)\b/i,
    questions: [
      "Quick technical one: what happens when you type a web address and press enter?",
      "How would you figure out why an app suddenly got slow?",
    ],
  },
  {
    pattern: /\b(financ\w*|accountant|accounting|audit\w*|investment|banking|cpa)\b/i,
    questions: ["Quick technical one: how do the three financial statements connect?", "How would you tell if a company is a good investment?"],
  },
  {
    pattern: /\b(data|analyst|analytics|sql|statistics?|machine learning)\b/i,
    questions: ["Quick technical one: how would you handle missing values in a dataset?", "How would you explain a SQL join to someone non-technical?"],
  },
  {
    pattern: /\b(marketing|brand|social media|content|communications)\b/i,
    questions: ["How would you tell if a marketing campaign actually worked?", "Who would you target first for a new campus coffee app, and why?"],
  },
  {
    pattern: /\b(business|commerce|mba|management|operations|sales|consult\w*|economics)\b/i,
    questions: ["Quick one: how would you decide if a new product idea is worth pursuing?", "A client's sales dropped twenty percent. Where would you start looking?"],
  },
  {
    pattern: /\b(nurs\w*|health\w*|medical|clinic\w*|pharmac\w*|patient)\b/i,
    questions: ["A patient seems anxious and confused. What would you do first?", "How do you make sure a shift handover doesn't miss anything?"],
  },
  {
    pattern: /\b(engineer\w*|mechanical|civil|electrical|chemical)\b/i,
    questions: ["How would you check a design is safe before it gets built?", "Walk me through how you'd troubleshoot a part that keeps failing."],
  },
  {
    pattern: /\b(design\w*|ux|ui|graphic)\b/i,
    questions: ["How do you decide what to change after a user test?", "How would you make a sign-up form easier to use?"],
  },
  {
    pattern: /\b(teach\w*|education|tutor\w*)\b/i,
    questions: ["How would you help a student who's falling behind?", "How do you keep a class engaged on a dull topic?"],
  },
];

const match = (text: string) => FIELDS.find((field) => field.pattern.test(text));

/** One or two questions from the person's field. The role they're practising for wins over their degree or headline. */
export function technicalQuestions(role: string, profile: Profile): string[] {
  const background = [...profile.targetRoles, profile.headline ?? "", ...profile.education.map((e) => e.program ?? "")].join(" ");
  return match(role)?.questions ?? match(background)?.questions ?? [];
}
