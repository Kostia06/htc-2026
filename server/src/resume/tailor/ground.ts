import { containsQuote, withoutBannedPhrases } from "../../recommend/verify";
import { editablePaths, readPath } from "../coach";
import type { Resume } from "../types";
import { BULLET_PATH, bulletsOf, resumeText } from "./paths";
import type { RequirementRef, TailorChange, TailorSection } from "./types";

export type GroundingInput = { resume: Resume; requirements: RequirementRef[]; profileText: string };

const MAX_CHANGES = 15;
const MAX_AFTER = 300;
const MAX_WHY = 200;

const NUMBER = /\d[\d,.]*/g;
const WORD = /[A-Za-z0-9][A-Za-z0-9+#./-]*/g;

const normalize = (text: string) => text.normalize("NFKC").replace(/\s+/g, " ").trim().replace(/[.!]+$/, "").toLowerCase();
const digits = (text: string) => new Set((text.match(NUMBER) ?? []).map((n) => n.replace(/[,.]+$/, "")));

// what a rewrite may draw on: a bullet only its own words and the entry it sits under, so a skill from elsewhere
// can't be pinned on a job that never used it; the summary may restate anything the resume or profile already says
function allowedTextFor(input: GroundingInput, path: string): string {
  const bullet = BULLET_PATH.exec(path);
  if (!bullet) return [resumeText(input.resume), input.profileText].join("\n");
  const index = Number(bullet[2]);
  const header = bullet[1] === "experience"
    ? `${input.resume.experience[index]?.role ?? ""} ${input.resume.experience[index]?.org ?? ""}`
    : input.resume.projects[index]?.name ?? "";
  return `${readPath(input.resume, path) ?? ""}\n${header}`;
}

// names, tools and acronyms: a capital past the first letter of a sentence, an inner capital (iOS), or a digit or
// symbol (C++, S3). Ordinary words are free to change; these are the claims that could be invented
function notableTerms(text: string): string[] {
  const terms: string[] = [];
  for (const match of text.matchAll(WORD)) {
    const word = match[0].replace(/[./-]+$/, "");
    if (word.length < 2 || /^\d[\d,.]*$/.test(word)) continue;
    const startsSentence = /(^|[.!?;:]\s*)$/.test(text.slice(0, match.index).trimEnd());
    const capitalised = /^[A-Z]/.test(word) && !startsSentence;
    if (capitalised || /[A-Z]/.test(word.slice(1)) || /[0-9+#]/.test(word)) terms.push(word);
  }
  return terms;
}

// the claim checks: every number, name and posting skill in the rewrite must already be in what it may draw on
export function isGrounded(after: string, allowed: string, requirements: RequirementRef[]): boolean {
  const known = digits(allowed);
  if ([...digits(after)].some((n) => !known.has(n))) return false;
  if (notableTerms(after).some((term) => !containsQuote(allowed, term))) return false;
  return requirements.every((r) => !containsQuote(after, r.topic) || containsQuote(allowed, r.topic));
}

const sectionOf = (path: string): TailorSection => (path === "summary" ? "summary" : (BULLET_PATH.exec(path)?.[1] as TailorSection));
const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/** Code, not the model, decides what stays: each change must point at a real base line, quote it, and add nothing it lacks. */
export function groundChanges(input: GroundingInput, proposed: unknown): TailorChange[] {
  if (!Array.isArray(proposed)) return [];
  const editable = new Set(editablePaths(input.resume).map((p) => p.path));
  const bulletsLeft = new Map<string, number>();
  const seen = new Set<string>();
  const kept: TailorChange[] = [];

  for (const item of proposed) {
    if (typeof item !== "object" || item === null) continue;
    const change = item as Record<string, unknown>;
    const path = typeof change.path === "string" ? change.path.trim() : "";
    if (!editable.has(path) || seen.has(path)) continue;
    const before = readPath(input.resume, path)!;
    if (typeof change.before === "string" && change.before.trim() && normalize(change.before) !== normalize(before)) continue;
    const why = text(change.why, MAX_WHY);
    if (!why) continue;

    if (change.action === "remove") {
      const entry = BULLET_PATH.exec(path);
      if (!entry) continue;
      const key = `${entry[1]}[${entry[2]}]`;
      const left = bulletsLeft.get(key) ?? bulletsOf(input.resume, entry[1], Number(entry[2])).length;
      if (left <= 1) continue;
      bulletsLeft.set(key, left - 1);
      kept.push({ id: "", kind: "trim", section: sectionOf(path), basedOn: path, before, after: "", why, requirement: null, accepted: true });
    } else {
      const requirement = typeof change.requirement === "number" ? input.requirements[change.requirement - 1] : undefined;
      if (!requirement) continue;
      const after = withoutBannedPhrases(text(change.after, MAX_AFTER));
      if (!after || normalize(after) === normalize(before)) continue;
      if (!isGrounded(after, allowedTextFor(input, path), input.requirements)) continue;
      kept.push({ id: "", kind: "reword", section: sectionOf(path), basedOn: path, before, after, why, requirement: requirement.text, accepted: true });
    }
    seen.add(path);
    if (kept.length === MAX_CHANGES) break;
  }
  return kept.map((change, i) => ({ ...change, id: `c${i + 1}` }));
}

