export const SKILL_SOURCES = ["resume", "interview", "self-reported"] as const;
export type SkillSource = (typeof SKILL_SOURCES)[number];

export type ProfileSkill = { name: string; source: SkillSource; evidence?: string };
export type Education = { school: string; program?: string; year?: string; expectedGraduation?: string };
export type Experience = { role: string; org: string; start?: string; end?: string; highlights?: string[] };
export type Project = { name: string; summary?: string };

export type Profile = {
  headline?: string;
  targetRoles: string[];
  goals: string[];
  skills: ProfileSkill[];
  education: Education[];
  experience: Experience[];
  projects: Project[];
  certifications: string[];
  updatedAt?: string;
};

type ProfileLists = Omit<Profile, "updatedAt" | "headline">;

// chips go by name; rows go by the same identity the merge uses
export type ProfileRemovals = Partial<Omit<ProfileLists, "skills"> & { skills: string[] }>;

export type ProfilePatch = Partial<Omit<Profile, "updatedAt">> & { remove?: ProfileRemovals };
