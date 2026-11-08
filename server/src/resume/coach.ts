import { withoutBannedPhrases } from "../recommend/verify";
import type { Resume, ResumeSection, Suggestion } from "./types";

export const ADD_NUMBER = "[add number]";
const MAX_SUGGESTIONS = 12;

// a path is a chain of names and indexes, e.g. experience[0].bullets[1]; only the strings a resume holds resolve
const SEGMENT = /([a-zA-Z]+)|\[(\d+)\]/g;

export function readPath(resume: Resume, path: string): string | undefined {
  let current: unknown = resume;
  for (const match of path.matchAll(SEGMENT)) {
    const key = match[1] ?? Number(match[2]);
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string | number, unknown>)[key];
  }
  return typeof current === "string" ? current : undefined;
}

// every string the coach may rewrite, listed with the path the model must echo back
export function editablePaths(resume: Resume, section?: ResumeSection): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  const want = (s: ResumeSection) => !section || section === s;
  if (want("summary") && resume.summary) out.push({ path: "summary", text: resume.summary });
  if (want("experience")) {
    resume.experience.forEach((e, i) => e.bullets.forEach((b, j) => out.push({ path: `experience[${i}].bullets[${j}]`, text: b })));
  }
  if (want("projects")) {
    resume.projects.forEach((p, i) => p.bullets.forEach((b, j) => out.push({ path: `projects[${i}].bullets[${j}]`, text: b })));
  }
  return out;
}

// a trailing full stop or a double space is not a rewrite
const normalize = (text: string) => text.normalize("NFKC").replace(/\s+/g, " ").trim().replace(/[.!]+$/, "").toLowerCase();
const NUMBER = /\$\s*\d[\d,.]*[kKmM]?|\d[\d,.]*(?:\s*%)?/g;

// a number the before never had was invented; keep the sentence, but leave the slot for the person to fill
export function withoutInventedNumbers(before: string, after: string) {
  const known = new Set((before.match(NUMBER) ?? []).map((n) => n.replace(/\s+/g, "")));
  return after.replace(NUMBER, (n) => (known.has(n.replace(/\s+/g, "")) ? n : ADD_NUMBER));
}

function isSuggestion(item: unknown): item is Suggestion {
  if (typeof item !== "object" || item === null) return false;
  const s = item as Record<string, unknown>;
  return typeof s.path === "string" && typeof s.after === "string";
}

// code, not the model, decides what counts: the path must exist and still say what the model quoted, the rewrite must change it,
// and it may not carry numbers or confidence claims the original never had
export function verifySuggestions(resume: Resume, proposed: unknown): Suggestion[] {
  if (!Array.isArray(proposed)) return [];
  const seen = new Set<string>();
  const kept: Suggestion[] = [];
  for (const item of proposed) {
    if (!isSuggestion(item) || seen.has(item.path)) continue;
    const before = readPath(resume, item.path);
    if (before === undefined || !before.trim()) continue;
    if (typeof item.before === "string" && item.before.trim() && normalize(item.before) !== normalize(before)) continue;
    const after = withoutBannedPhrases(withoutInventedNumbers(before, item.after)).trim();
    if (!after || normalize(after) === normalize(before)) continue;
    seen.add(item.path);
    kept.push({ path: item.path, before, after, why: typeof item.why === "string" ? item.why.trim() : "" });
    if (kept.length === MAX_SUGGESTIONS) break;
  }
  return kept;
}
