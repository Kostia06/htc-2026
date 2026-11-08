import type { Profile } from "../memory/profile/types";
import { FEED_FIELDS, type FeedField } from "./types";

export const FIELD_LABELS: Record<FeedField, string> = {
  cs: "computer science",
  business: "business",
  design: "design",
  health: "health",
  general: "your path",
};

// word stems, matched at the start of a word, so "nurse" and "nursing" both count
const STEMS: Record<Exclude<FeedField, "general">, string[]> = {
  cs: ["comput", "software", "developer", "programm", "data", "cyber", "machine learning", "informati", "engineer", "web dev", "devops"],
  business: ["business", "commerce", "marketing", "financ", "account", "management", "mba", "econom", "sales", "entrepreneur", "human resources"],
  design: ["design", "arts", "artist", "fine art", "ux", "graphic", "illustrat", "creative", "animation", "architect", "photograph"],
  health: ["nurs", "health", "medic", "kinesiolog", "pharma", "biolog", "dental", "care aide", "paramedic", "therap", "psycholog"],
};

const lower = (text: string) => ` ${text.toLowerCase()} `;
const names = (stems: string[], text: string) => stems.some((stem) => text.includes(` ${stem}`));

// the person's own words come first: program of study, headline, then the roles they want
export function fieldsOf(profile: Profile): FeedField[] {
  const text = lower(
    [...profile.education.map((e) => e.program ?? ""), profile.headline ?? "", ...profile.targetRoles, ...profile.goals].join(" "),
  );
  const fields = FEED_FIELDS.filter((field): field is Exclude<FeedField, "general"> => field !== "general" && names(STEMS[field], text));
  return fields.length > 0 ? fields : ["general"];
}
