import type { Resume } from "./types";

// "skillit" is the default look; "plain" is the bare ATS-style page some postings ask for
export const RESUME_TEMPLATES = ["skillit", "plain"] as const;
export type ResumeTemplate = (typeof RESUME_TEMPLATES)[number];
export const RESUME_FORMATS = ["pdf", "docx"] as const;
export type ResumeFormat = (typeof RESUME_FORMATS)[number];

export const asTemplate = (value: unknown): ResumeTemplate => RESUME_TEMPLATES.find((t) => t === value) ?? "skillit";
export const asFormat = (value: unknown): ResumeFormat | undefined => RESUME_FORMATS.find((f) => f === value);

export const joinPresent = (parts: string[], separator: string) => parts.filter(Boolean).join(separator);
export const dates = (start: string, end: string) => joinPresent([start, end], " – ");

export type DocEntry = { title: string; subtitle: string; date: string; bullets: string[] };
export type DocRow = { key: string; value: string };
export type DocSection = { title: string; text?: string; entries?: DocEntry[]; rows?: DocRow[] };
export type ResumeDoc = { name: string; contact: string[]; headline: string; sections: DocSection[] };

// "Languages: Python, SQL" becomes a labelled row; loose skills share one unlabelled row
function skillRows(skills: string[]): DocRow[] {
  const rows: DocRow[] = [];
  const loose: string[] = [];
  for (const skill of skills) {
    const labelled = /^([^:]{1,32}):\s*(.+)$/.exec(skill);
    if (labelled) rows.push({ key: labelled[1].trim(), value: labelled[2].trim() });
    else loose.push(skill);
  }
  if (loose.length) rows.push({ key: "", value: loose.join(", ") });
  return rows;
}

// the resume reshaped into the template's order: header, then Education, Experience, Projects, Skills
export function skillitDoc(resume: Resume): ResumeDoc {
  const sections: DocSection[] = [
    {
      title: "Education",
      entries: resume.education.map((s) => ({ title: s.program || s.school, subtitle: s.program ? s.school : "", date: s.year, bullets: [] })),
    },
    {
      title: "Experience",
      entries: resume.experience.map((j) => ({ title: j.role || j.org, subtitle: j.role ? j.org : "", date: dates(j.start, j.end), bullets: j.bullets })),
    },
    { title: "Projects", entries: resume.projects.map((p) => ({ title: p.name, subtitle: p.link, date: "", bullets: p.bullets })) },
    { title: "Skills", rows: skillRows(resume.skills) },
  ];
  return {
    name: resume.contact.name || "Resume",
    contact: [resume.contact.phone, resume.contact.email, ...resume.contact.links].filter(Boolean),
    headline: resume.summary,
    sections: sections.filter((s) => s.entries?.length || s.rows?.length),
  };
}

// the plain page: summary as its own section, role and company on one line
export function plainDoc(resume: Resume): ResumeDoc {
  const sections: DocSection[] = [
    { title: "Summary", text: resume.summary },
    {
      title: "Experience",
      entries: resume.experience.map((j) => ({ title: joinPresent([j.role, j.org], ", "), subtitle: "", date: dates(j.start, j.end), bullets: j.bullets })),
    },
    { title: "Education", entries: resume.education.map((s) => ({ title: s.school, subtitle: s.program, date: s.year, bullets: [] })) },
    { title: "Projects", entries: resume.projects.map((p) => ({ title: p.name, subtitle: "", date: p.link, bullets: p.bullets })) },
    { title: "Skills", text: resume.skills.join(", ") },
  ];
  return {
    name: resume.contact.name || "Resume",
    contact: [resume.contact.email, resume.contact.phone, ...resume.contact.links].filter(Boolean),
    headline: "",
    sections: sections.filter((s) => s.text || s.entries?.length),
  };
}

export const resumeDoc = (resume: Resume, template: ResumeTemplate) => (template === "plain" ? plainDoc(resume) : skillitDoc(resume));
