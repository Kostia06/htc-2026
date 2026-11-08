// Resume.swift + Resume+Suggestions.swift: the shape of a resume, and where a coach suggestion lands.

export const SECTIONS = ['contact', 'summary', 'experience', 'education', 'projects', 'skills']

export const SECTION_TITLES = {
  contact: 'Contact',
  summary: 'Summary',
  experience: 'Experience',
  education: 'Education',
  projects: 'Projects',
  skills: 'Skills',
}

export const BLANK = {
  experience: { role: '', org: '', start: '', end: '', bullets: [] },
  education: { school: '', program: '', year: '' },
  projects: { name: '', bullets: [], link: '' },
}

export function normalizeResume(r = {}) {
  return {
    contact: { name: '', email: '', phone: '', links: [], ...r.contact },
    summary: r.summary ?? '',
    experience: (r.experience ?? []).map((e) => ({ ...BLANK.experience, ...e, bullets: e.bullets ?? [] })),
    education: (r.education ?? []).map((e) => ({ ...BLANK.education, ...e })),
    projects: (r.projects ?? []).map((p) => ({ ...BLANK.projects, ...p, bullets: p.bullets ?? [] })),
    skills: r.skills ?? [],
    updatedAt: r.updatedAt ?? null,
  }
}

/** `summary` or `experience[0].bullets[1]` / `projects[2].bullets[0]`; anything else is not a line. */
function locate(path) {
  if (path === 'summary') return { summary: true }
  const m = /^(experience|projects)\[(\d+)\]\.bullets\[(\d+)\]$/.exec(path)
  return m ? { section: m[1], entry: Number(m[2]), bullet: Number(m[3]) } : null
}

export function textAt(resume, path) {
  const at = locate(path)
  if (!at) return null
  if (at.summary) return resume.summary
  return resume[at.section][at.entry]?.bullets[at.bullet] ?? null
}

/** Puts the rewrite where its path points; null when the path no longer leads anywhere. */
export function applySuggestion(resume, suggestion) {
  const at = locate(suggestion.path)
  if (!at) return null
  if (at.summary) return { ...resume, summary: suggestion.after }
  const entry = resume[at.section][at.entry]
  if (entry?.bullets[at.bullet] === undefined) return null
  const bullets = entry.bullets.map((b, i) => (i === at.bullet ? suggestion.after : b))
  return { ...resume, [at.section]: resume[at.section].map((e, i) => (i === at.entry ? { ...e, bullets } : e)) }
}

/** "Experience · ATB Financial" */
export function labelFor(resume, path) {
  const at = locate(path)
  if (!at) return 'Resume'
  if (at.summary) return 'Summary'
  const entry = resume[at.section][at.entry]
  const detail = at.section === 'experience' ? entry?.org : entry?.name
  const name = SECTION_TITLES[at.section]
  return detail ? `${name} · ${detail}` : name
}
