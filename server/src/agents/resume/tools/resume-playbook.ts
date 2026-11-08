import { FIELDS, type Field } from "../../../knowledge/interview/types";
import { actionVerbs, atsDonts, atsDos, bulletPatterns, commonMistakes, sectionOrders, STAGES, type Stage } from "../../../knowledge/resume";
import type { ToolDefinition } from "../../core/types";
import { text } from "../../shared-tools/args";

const TOPICS = ["bullets", "verbs", "mistakes", "sections", "ats"] as const;
type Topic = (typeof TOPICS)[number];
const DEFAULT_TOPICS: Topic[] = ["bullets", "verbs", "mistakes"];

export const resumePlaybook: ToolDefinition = {
  name: "resume_playbook",
  description:
    "Skillit's curated resume guidance: strong bullet patterns for a field, action verbs, common mistakes, section order for a career stage, and ATS do's and don'ts. " +
    "General guidance only: it shapes wording, never adds facts about the person.",
  parameters: {
    type: "object",
    properties: {
      field: { type: "string", enum: [...FIELDS] },
      stage: { type: "string", enum: [...STAGES], description: "the person's career stage, for the section order" },
      topics: { type: "array", items: { type: "string", enum: [...TOPICS] }, description: "leave out for bullets, verbs and mistakes" },
    },
    required: ["field"],
  },
  run: async (args) => {
    const field = text(args.field) as Field;
    if (!FIELDS.includes(field)) return { error: `field must be one of ${FIELDS.join(", ")}` };
    const asked = Array.isArray(args.topics) ? args.topics.filter((t): t is Topic => TOPICS.includes(t)) : [];
    const topics = new Set(asked.length ? asked : DEFAULT_TOPICS);
    const stage = text(args.stage) as Stage;
    return {
      field,
      ...(topics.has("bullets") ? { bulletPatterns: bulletPatterns[field] } : {}),
      ...(topics.has("verbs") ? { actionVerbs } : {}),
      ...(topics.has("mistakes") ? { commonMistakes } : {}),
      ...(topics.has("sections") ? { sectionOrder: sectionOrders.find((s) => s.stage === stage) ?? sectionOrders.find((s) => s.stage === "student") } : {}),
      ...(topics.has("ats") ? { ats: { dos: atsDos, donts: atsDonts } } : {}),
    };
  },
};
