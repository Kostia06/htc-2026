import { editablePaths, verifySuggestions } from "../../../resume/coach";
import { RESUME_SECTIONS, type Resume, type ResumeSection } from "../../../resume/types";
import type { Skill } from "../../core/types";

export type CoachInput = { resume: Resume; targetRole?: string; section?: ResumeSection; company?: string };

const MAX_SUGGESTIONS = 12;

// contact details never reach the model; only the lines it may rewrite, each tagged with the path it must echo back
function numberedLines(input: CoachInput) {
  const lines = editablePaths(input.resume, input.section);
  if (lines.length === 0) return "(this resume has no summary or bullets yet)";
  return lines.map(({ path, text }) => `${path}: ${text}`).join("\n");
}

export const resumeCoach: Skill<CoachInput> = {
  name: "resume-coach",
  description: "Rewrite resume bullets to be specific and results-focused for the person's target role, without inventing anything.",
  platforms: ["app"],
  personal: true,
  tools: ["profile", "company_insights", "github_profile"],
  maxSteps: 5,
  instructions: `Improve this person's resume lines for the role they want. Each line is listed with its path.
Rewrite only the lines worth changing: start with a strong verb, say what was done, how, and what it led to.
Honesty rules:
- Only rephrase what the line already says. Never add a tool, skill, team size, date, title or employer it doesn't mention.
- Never invent a number. Where a result needs one, write [add number] in its place so the person fills it in.
- No "perfect fit", "ideal candidate", "guaranteed", "definitely" or percentages about the person.
When a company is set, call company_insights once and match wording to what they value; use profile if the target role is unclear.
For a project line, github_profile shows what that repo really is; it only helps you word the line, never adds to what the line claims.
Call finish with suggestions: path copied exactly, before copied word for word, after as the rewrite, why in one sentence.`,
  inputSchema: {
    type: "object",
    properties: {
      resume: { type: "object" },
      targetRole: { type: "string", maxLength: 120 },
      section: { type: "string", enum: [...RESUME_SECTIONS] },
      company: { type: "string", maxLength: 100, description: "company slug" },
    },
    required: ["resume"],
  },
  outputSchema: {
    type: "object",
    properties: {
      suggestions: {
        type: "array",
        maxItems: MAX_SUGGESTIONS,
        items: {
          type: "object",
          properties: {
            path: { type: "string", description: "the path exactly as listed" },
            before: { type: "string", description: "the current line, word for word" },
            after: { type: "string", description: "the rewrite; [add number] where a figure belongs" },
            why: { type: "string", description: "one sentence" },
          },
          required: ["path", "before", "after", "why"],
        },
      },
    },
    required: ["suggestions"],
  },
  buildGoal: (input, { company }) => {
    const target = input.targetRole ? `Target role: ${input.targetRole}.` : "Target role: not set; read the profile for it.";
    const employer = company ? ` Applying to ${company.name}.` : "";
    return `${target}${employer}\n\nResume lines:\n${numberedLines(input)}`;
  },
  finalize: (output, _toolCalls, input) => ({ suggestions: input ? verifySuggestions(input.resume, output.suggestions) : [] }),
};
