import type { Resume } from "../types";

/** experience[0].bullets[1] or projects[2].bullets[0]: the only lines besides the summary a tailoring may touch. */
export const BULLET_PATH = /^(experience|projects)\[(\d+)\]\.bullets\[(\d+)\]$/;

export function bulletsOf(resume: Resume, section: string, index: number): string[] {
  return (section === "experience" ? resume.experience[index]?.bullets : resume.projects[index]?.bullets) ?? [];
}

export function resumeText(resume: Resume): string {
  return [
    resume.summary,
    ...resume.experience.flatMap((e) => [e.role, e.org, ...e.bullets]),
    ...resume.projects.flatMap((p) => [p.name, ...p.bullets]),
    ...resume.education.flatMap((e) => [e.school, e.program]),
    resume.skills.join(", "),
  ].join("\n");
}
