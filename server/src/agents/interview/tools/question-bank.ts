import { FIELDS, type Field, fieldQuestions, ROUNDS, type Round } from "../../../knowledge/interview";
import type { ToolDefinition } from "../../core/types";
import { text } from "../../shared-tools/args";

const MAX_QUESTIONS = 12;

export const questionBank: ToolDefinition = {
  name: "question_bank",
  description:
    "Skillit's curated example interview questions for a field, each with its round and what a good answer shows. " +
    "They are examples written from common question patterns, never reports from real candidates.",
  parameters: {
    type: "object",
    properties: {
      field: { type: "string", enum: [...FIELDS], description: "the field of the role; changer for career changers, non_student for people not in school" },
      round: { type: "string", enum: [...ROUNDS], description: "only questions from this kind of round" },
    },
    required: ["field"],
  },
  run: async (args) => {
    const field = text(args.field) as Field;
    if (!FIELDS.includes(field)) return { error: `field must be one of ${FIELDS.join(", ")}` };
    const round = text(args.round) as Round;
    const questions = fieldQuestions[field].filter((q) => !ROUNDS.includes(round) || q.round === round).slice(0, MAX_QUESTIONS);
    return { example: true, field, questions };
  },
};
