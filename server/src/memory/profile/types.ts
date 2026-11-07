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

export type ProfilePatch = Partial<Omit<Profile, "updatedAt">>;
