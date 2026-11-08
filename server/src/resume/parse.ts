import type { Profile } from "../memory/profile/types";
import { emptyResume, type Resume, type ResumeEducation, type ResumeExperience, type ResumeProject } from "./types";

const MAX_TEXT = 400;
const MAX_SUMMARY = 800;
const LIMITS = { experience: 10, education: 5, projects: 10, skills: 40, bullets: 8, links: 5 };

type Fields = Record<string, unknown>;
const isFields = (value: unknown): value is Fields => typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown, max = MAX_TEXT) => (typeof value === "string" ? value.trim().slice(0, max) : "");

function textList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text(item)).filter(Boolean).slice(0, limit);
}

function parseExperience(item: unknown): ResumeExperience | undefined {
  if (!isFields(item)) return undefined;
  const role = text(item.role);
  const org = text(item.org);
  if (!role && !org) return undefined;
  return { role, org, start: text(item.start), end: text(item.end), bullets: textList(item.bullets, LIMITS.bullets) };
}

function parseEducation(item: unknown): ResumeEducation | undefined {
  if (!isFields(item)) return undefined;
  const school = text(item.school);
  if (!school) return undefined;
  return { school, program: text(item.program), year: text(item.year) };
}

function parseProject(item: unknown): ResumeProject | undefined {
  if (!isFields(item)) return undefined;
  const name = text(item.name);
  if (!name) return undefined;
  return { name, bullets: textList(item.bullets, LIMITS.bullets), link: text(item.link) };
}

function list<T>(value: unknown, parse: (item: unknown) => T | undefined, limit: number): T[] {
  if (!Array.isArray(value)) return [];
  return value.map(parse).filter((item): item is T => item !== undefined).slice(0, limit);
}

// boundary for anything a client sends: a whole resume comes in, malformed entries are dropped, never trusted
export function parseResume(input: unknown): Resume | null {
  if (!isFields(input)) return null;
  const contact = isFields(input.contact) ? input.contact : {};
  return {
    contact: {
      name: text(contact.name),
      email: text(contact.email),
      phone: text(contact.phone),
      location: text(contact.location),
      links: textList(contact.links, LIMITS.links),
    },
    summary: text(input.summary, MAX_SUMMARY),
    experience: list(input.experience, parseExperience, LIMITS.experience),
    education: list(input.education, parseEducation, LIMITS.education),
    projects: list(input.projects, parseProject, LIMITS.projects),
    skills: textList(input.skills, LIMITS.skills),
  };
}

// the first resume a person sees is their profile laid out as one, so nothing starts blank after onboarding
export function seedFromProfile(profile: Profile): Resume {
  return {
    ...emptyResume(),
    summary: profile.headline ?? "",
    experience: profile.experience.map((e) => ({ role: e.role, org: e.org, start: e.start ?? "", end: e.end ?? "", bullets: e.highlights ?? [] })),
    education: profile.education.map((e) => ({ school: e.school, program: e.program ?? "", year: e.expectedGraduation ?? e.year ?? "" })),
    projects: profile.projects.map((p) => ({ name: p.name, bullets: p.summary ? [p.summary] : [], link: "" })),
    skills: profile.skills.map((s) => s.name),
  };
}
