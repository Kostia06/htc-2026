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
    contact: { name: '', email: '', phone: '', location: '', links: [], ...r.contact },
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


const lineText = (value) => (typeof value === 'string' ? value.trim() : typeof value?.text === 'string' ? value.text.trim() : '')
const lines = (value) => (Array.isArray(value) ? value.map(lineText).filter(Boolean) : [])
const strings = (value) => (Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()) : [])

/** Builds an analysis-only copy of the resume, excluding direct contact details. */
export function resumeToAnalysisText(resume = {}) {
  const sections = []
  if (resume.summary?.trim()) sections.push(`SUMMARY\n${resume.summary.trim()}`)

  if (resume.skills?.length) sections.push(`SKILLS\n${strings(resume.skills).join(', ')}`)

  if (resume.experience?.length) {
    const entries = resume.experience.map((item) => {
      const heading = [item.role, item.org, [item.start, item.end].filter(Boolean).join(' – ')].filter(Boolean).join(' | ')
      return [heading, ...lines(item.bullets).map((bullet) => `- ${bullet}`)].filter(Boolean).join('\n')
    })
    sections.push(`EXPERIENCE\n${entries.join('\n\n')}`)
  }

  if (resume.projects?.length) {
    const entries = resume.projects.map((item) => {
      const heading = [item.name, item.link].filter(Boolean).join(' | ')
      return [heading, ...lines(item.bullets).map((bullet) => `- ${bullet}`)].filter(Boolean).join('\n')
    })
    sections.push(`PROJECTS\n${entries.join('\n\n')}`)
  }

  if (resume.education?.length) {
    sections.push(`EDUCATION\n${resume.education.map((item) => [item.school, item.program, item.year].filter(Boolean).join(' | ')).join('\n')}`)
  }

  return sections.join('\n\n').slice(0, 30000)
}

function generatedDates(value) {
  const dates = typeof value === 'string' ? value.trim() : ''
  const match = /^(.*?)\s+(?:–|—|-|to)\s+(.*?)$/i.exec(dates)
  return match ? { start: match[1].trim(), end: match[2].trim() } : { start: dates, end: '' }
}

/** Converts the AI draft into the existing editor's data model, retaining the person's contact details. */
export function applyGeneratedResume(generated = {}, current = {}) {
  const existing = normalizeResume(current)
  const next = { ...existing }

  const summary = generated.professionalSummary ?? generated.summary
  if (typeof summary === 'string' && summary.trim()) next.summary = summary.trim()

  const skills = strings(generated.technicalSkills ?? generated.skills)
  if (skills.length) next.skills = skills

  if (Array.isArray(generated.experience) && generated.experience.length) {
    next.experience = generated.experience
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const dates = generatedDates(item.dates)
        return {
          role: typeof item.role === 'string' ? item.role : '',
          org: typeof (item.organization ?? item.org) === 'string' ? (item.organization ?? item.org) : '',
          start: typeof item.start === 'string' ? item.start : dates.start,
          end: typeof item.end === 'string' ? item.end : dates.end,
          bullets: lines(item.bullets),
        }
      })
      .filter((item) => item.role || item.org)
  }

  if (Array.isArray(generated.projects) && generated.projects.length) {
    next.projects = generated.projects
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const bullets = lines(item.bullets)
        const technologies = strings(item.technologies)
        if (technologies.length) bullets.unshift(`Technologies: ${technologies.join(', ')}`)
        return {
          name: typeof (item.name ?? item.title) === 'string' ? (item.name ?? item.title) : '',
          bullets,
          link: typeof (item.link ?? item.url) === 'string' ? (item.link ?? item.url) : '',
        }
      })
      .filter((item) => item.name)
  }

  if (Array.isArray(generated.education) && generated.education.length) {
    next.education = generated.education
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        school: typeof (item.institution ?? item.school) === 'string' ? (item.institution ?? item.school) : '',
        program: typeof (item.credential ?? item.program) === 'string' ? (item.credential ?? item.program) : '',
        year: typeof (item.dates ?? item.year) === 'string' ? (item.dates ?? item.year) : '',
      }))
      .filter((item) => item.school)
  }

  return normalizeResume(next)
}
