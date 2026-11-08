import { atsDonts, atsDos } from "./ats";
import { bulletPatterns } from "./bullets";
import { commonMistakes } from "./mistakes";
import { sectionOrders } from "./sections";
import { actionVerbs } from "./verbs";

export { actionVerbs, atsDonts, atsDos, bulletPatterns, commonMistakes, sectionOrders };
export * from "./types";

// the ATS rules in one compact block, for skills that take no tools and read them in their instructions
export const atsChecklist = () =>
  [...atsDos.map((r) => `- Do: ${r.rule}.`), ...atsDonts.map((r) => `- Don't: ${r.rule}.`)].join("\n").replaceAll("..", ".");
