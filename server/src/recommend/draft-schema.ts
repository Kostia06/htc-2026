import type { JsonSchema } from "../lib/json-schema";

export const MAX_ITEMS = 5;

const verbatim = (from: string) => `copied word for word from ${from}`;

export const requirementSchema: JsonSchema = {
  type: "object",
  properties: {
    quote: { type: "string", minLength: 2, description: verbatim("the page") },
    kind: { type: "string", enum: ["required", "preferred", "hard"], description: "hard: licence, enrolment, degree, GPA, work authorisation or graduation timing" },
    met: { type: "string", enum: ["yes", "no", "unknown"], description: "unknown when the profile is silent" },
    evidence: { type: "string", description: `${verbatim("what the profile or recall tool returned")}; needed for yes` },
  },
  required: ["quote", "kind", "met"],
};

// fields every recommendation item has; skills add their own
export const draftItemProperties: Record<string, JsonSchema> = {
  title: { type: "string" },
  source_url: { type: "string", description: "the exact URL you fetched with fetch_page" },
  requirements: { type: "array", maxItems: 15, items: requirementSchema },
  next_step: { type: "string", description: "one concrete action to take now" },
  path: { type: "string", minLength: 1, description: "a concrete route there if this is a long-term goal: named courses, a UREX or USRA project, or an entry role" },
  question: { type: "string", description: "the one question that would settle an unknown requirement" },
};
export const draftItemRequired = ["title", "source_url", "requirements", "next_step", "path"];

export const EXTRACTION_RULES = `Rules:
- You do not choose how good a fit anything is. Code decides that from your quotes, so be exact.
- Every requirement "quote" is copied word for word from a page you fetched. If the page doesn't say it, leave it out.
- "met" is yes only with "evidence" copied word for word from what profile or recall returned; no when the profile clearly lacks it; unknown when it is silent.
- "kind" is required or preferred as the page labels it, or hard for licences, enrolment, a required degree, GPA, work authorisation and graduation timing.
- Only recommend pages you fetched with fetch_page; anything else is discarded.
- Never write "perfect fit", "ideal candidate", "guaranteed", "you will get", "definitely", or a percentage for fit or chances.
- Do not use name, gender, age or nationality for anything.`;
