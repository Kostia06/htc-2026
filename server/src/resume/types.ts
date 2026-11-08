export type ResumeContact = { name: string; email: string; phone: string; location: string; links: string[] };
export type ResumeExperience = { role: string; org: string; start: string; end: string; bullets: string[] };
export type ResumeEducation = { school: string; program: string; year: string };
export type ResumeProject = { name: string; bullets: string[]; link: string };

export type Resume = {
  contact: ResumeContact;
  summary: string;
  experience: ResumeExperience[];
  education: ResumeEducation[];
  projects: ResumeProject[];
  skills: string[];
  updatedAt?: string;
};

export const RESUME_SECTIONS = ["summary", "experience", "education", "projects", "skills"] as const;
export type ResumeSection = (typeof RESUME_SECTIONS)[number];

// one rewrite the person can accept or skip; path points at the string it replaces, e.g. experience[0].bullets[1]
export type Suggestion = { path: string; before: string; after: string; why: string };

export const emptyResume = (): Resume => ({
  contact: { name: "", email: "", phone: "", location: "", links: [] },
  summary: "",
  experience: [],
  education: [],
  projects: [],
  skills: [],
});
