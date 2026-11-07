import type { ToolCallRecord } from "../core/loop";
import type { Skill, SkillOutput } from "../core/types";

const QUESTION_COUNT = 5;

type Question = { text: string; why: string; reported: boolean };

const normalise = (text: string) => text.trim().toLowerCase();

// "reported" must mean real candidates asked it, so it is checked against what company_insights returned
function reportedQuestions(toolCalls: ToolCallRecord[]) {
  const reported = new Set<string>();
  for (const call of toolCalls.filter((c) => c.name === "company_insights")) {
    const questions = (call.result as { questions?: { text: string; example: boolean }[] }).questions ?? [];
    for (const q of questions.filter((q) => !q.example)) reported.add(normalise(q.text));
  }
  return reported;
}

export const interviewPrep: Skill<{ company: string; role?: string }> = {
  name: "interview-prep",
  description: "Pick five interview questions for this person and company, weighted toward their weak spots.",
  platforms: ["app", "vr"],
  personal: true,
  tools: ["company_insights", "recall", "company_facts", "queue_research"],
  maxSteps: 8,
  instructions: `Pick exactly ${QUESTION_COUNT} interview questions this person should practise for the company and role in the goal.
1. Call company_insights. Questions with example: false were reported by real candidates. Use those first, copied word for word.
2. Call recall for this person's weaknesses and goals. Choose the remaining questions to work on their weak spots.
3. If the company has few facts or no reported questions, call queue_research so there is more next time,
   then fill the gaps with questions typical for the role.
For each question, "why" says in one sentence why it matters for this person.
Set "reported" to true only for questions copied from company_insights reports.
"focus" is one to three short themes this person should work on before the interview.`,
  inputSchema: {
    type: "object",
    properties: {
      company: { type: "string", description: "company slug", maxLength: 100 },
      role: { type: "string", maxLength: 100 },
    },
    required: ["company"],
  },
  outputSchema: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        minItems: QUESTION_COUNT,
        maxItems: QUESTION_COUNT,
        items: {
          type: "object",
          properties: { text: { type: "string" }, why: { type: "string" }, reported: { type: "boolean" } },
          required: ["text", "why", "reported"],
        },
      },
      focus: { type: "array", maxItems: 3, items: { type: "string" } },
    },
    required: ["questions", "focus"],
  },
  buildGoal: (input, { company }) => `Prepare interview questions for the ${input.role ?? "entry-level"} role at ${company?.name ?? input.company}.`,
  finalize: (output, toolCalls): SkillOutput => {
    const reported = reportedQuestions(toolCalls);
    const questions = (output.questions as Question[]).map((q) => ({ ...q, reported: reported.has(normalise(q.text)) }));
    return { ...output, questions };
  },
};
