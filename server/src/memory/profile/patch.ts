import { anonymize } from "../../lib/anonymize";
import { SKILL_SOURCES, type Profile, type ProfilePatch, type ProfileRemovals, type ProfileSkill, type SkillSource } from "./types";

const MAX_TEXT = 300;
const LIMITS = { skills: 50, targetRoles: 10, goals: 10, education: 5, experience: 15, projects: 15, certifications: 20, highlights: 6 };

// resume evidence beats something said in an interview, which beats an unbacked claim
const SOURCE_STRENGTH: Record<SkillSource, number> = { resume: 3, interview: 2, "self-reported": 1 };

export const emptyProfile = (): Profile => ({
  targetRoles: [],
  goals: [],
  skills: [],
  education: [],
  experience: [],
  projects: [],
  certifications: [],
});

type Fields = Record<string, unknown>;
const isFields = (value: unknown): value is Fields => typeof value === "object" && value !== null && !Array.isArray(value);

function cleanText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = anonymize(value.trim()).slice(0, MAX_TEXT);
  return text || undefined;
}

function cleanList<T>(value: unknown, parse: (item: unknown) => T | undefined): T[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map(parse).filter((item): item is T => item !== undefined);
}

function withoutEmpty<T extends Fields>(record: T): T {
  return Object.fromEntries(Object.entries(record).filter(([, v]) => v !== undefined)) as T;
}

function parseSkill(item: unknown): ProfileSkill | undefined {
  if (!isFields(item)) return undefined;
  const name = cleanText(item.name);
  const source = SKILL_SOURCES.find((s) => s === item.source);
  if (!name || !source) return undefined;
  return withoutEmpty({ name, source, evidence: cleanText(item.evidence) });
}

function parseRecord<K extends string>(required: K, optional: string[]) {
  return (item: unknown) => {
    if (!isFields(item)) return undefined;
    const key = cleanText(item[required]);
    if (!key) return undefined;
    const rest = Object.fromEntries(optional.map((field) => [field, cleanText(item[field])]));
    const highlights = cleanList(item.highlights, cleanText)?.slice(0, LIMITS.highlights);
    return withoutEmpty({ [required]: key, ...rest, highlights: highlights?.length ? highlights : undefined });
  };
}

const parsers = {
  skills: parseSkill,
  targetRoles: cleanText,
  goals: cleanText,
  certifications: cleanText,
  education: parseRecord("school", ["program", "year", "expectedGraduation"]),
  experience: parseRecord("role", ["org", "start", "end"]),
  projects: parseRecord("name", ["summary"]),
};

function parseLists(input: Fields, listParsers: Record<string, (item: unknown) => unknown>): Fields {
  const lists: Fields = {};
  for (const [field, parse] of Object.entries(listParsers)) {
    const list = cleanList(input[field], parse);
    if (list?.length) lists[field] = list;
  }
  return lists;
}

// boundary for anything a model or a client sends: unknown fields and malformed entries are dropped, never trusted
export function parsePatch(input: unknown): ProfilePatch | null {
  if (!isFields(input)) return null;
  const patch: Fields = parseLists(input, parsers);
  const headline = cleanText(input.headline);
  if (headline) patch.headline = headline;
  if (isFields(input.remove)) {
    const remove = parseLists(input.remove, { ...parsers, skills: cleanText });
    if (Object.keys(remove).length) patch.remove = remove;
  }
  return patch as ProfilePatch;
}

const keyOf = (text: string) => text.toLowerCase();
const educationKey = (e: Profile["education"][number]) => keyOf(`${e.school}|${e.program ?? ""}`);
const experienceKey = (e: Profile["experience"][number]) => keyOf(`${e.role}|${e.org}|${e.start ?? ""}`);

function without<T>(current: T[], removed: T[] | undefined, key: (item: T) => string) {
  if (!removed?.length) return current;
  const gone = new Set(removed.map(key));
  return current.filter((item) => !gone.has(key(item)));
}

// removals run before additions, so editing a row is one patch: remove the old identity, add the new one
function withoutRemoved(profile: Profile, remove: ProfileRemovals | undefined): Profile {
  if (!remove) return profile;
  return {
    ...profile,
    skills: without(profile.skills, remove.skills?.map((name) => ({ name }) as ProfileSkill), (s) => keyOf(s.name)),
    targetRoles: without(profile.targetRoles, remove.targetRoles, keyOf),
    goals: without(profile.goals, remove.goals, keyOf),
    certifications: without(profile.certifications, remove.certifications, keyOf),
    education: without(profile.education, remove.education, educationKey),
    experience: without(profile.experience, remove.experience, experienceKey),
    projects: without(profile.projects, remove.projects, (p) => keyOf(p.name)),
  };
}

function mergeSkills(current: ProfileSkill[], incoming: ProfileSkill[]) {
  const byName = new Map(current.map((skill) => [keyOf(skill.name), skill]));
  for (const skill of incoming) {
    const existing = byName.get(keyOf(skill.name));
    if (!existing || SOURCE_STRENGTH[skill.source] >= SOURCE_STRENGTH[existing.source]) byName.set(keyOf(skill.name), skill);
  }
  return [...byName.values()].slice(0, LIMITS.skills);
}

function mergeBy<T>(current: T[], incoming: T[] | undefined, key: (item: T) => string, limit: number) {
  const byKey = new Map(current.map((item) => [key(item), item]));
  for (const item of incoming ?? []) if (!byKey.has(key(item))) byKey.set(key(item), item);
  return [...byKey.values()].slice(0, limit);
}

// re-parsed here so no write path can skip the scrubbing and limits, even with an already-typed patch
export function applyPatch(current: Profile, unchecked: ProfilePatch): Profile {
  const patch = parsePatch(unchecked) ?? {};
  const profile = withoutRemoved(current, patch.remove);
  return {
    headline: patch.headline ?? profile.headline,
    skills: mergeSkills(profile.skills, patch.skills ?? []),
    targetRoles: mergeBy(profile.targetRoles, patch.targetRoles, keyOf, LIMITS.targetRoles),
    goals: mergeBy(profile.goals, patch.goals, keyOf, LIMITS.goals),
    certifications: mergeBy(profile.certifications, patch.certifications, keyOf, LIMITS.certifications),
    education: mergeBy(profile.education, patch.education, educationKey, LIMITS.education),
    experience: mergeBy(profile.experience, patch.experience, experienceKey, LIMITS.experience),
    projects: mergeBy(profile.projects, patch.projects, (p) => keyOf(p.name), LIMITS.projects),
    updatedAt: new Date().toISOString(),
  };
}

export const isEmptyPatch = (patch: ProfilePatch) => Object.keys(patch).length === 0;
