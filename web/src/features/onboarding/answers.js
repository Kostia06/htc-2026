// Answers to profile, and resume draft to answers: OnboardingAnswers.swift, kept in step with the iOS app.
import { sameText } from '../../lib/format'
import { QUESTIONS } from './questions'

const NOT_SURE = 'Not sure yet'
const list = (value) => (Array.isArray(value) ? value : value ? [value] : [])
const optionsOf = (id) => QUESTIONS.find((q) => q.id === id).options
const blank = (text) => !text || !String(text).trim()

export const RESUME_ACCEPT = '.pdf,.doc,.docx,.odt,.rtf,.txt,.md,.html,.pptx,image/*'

export function isAnswered(question, value) {
  if (question.type === 'text') return Object.values(value ?? {}).some((v) => !blank(v))
  return Array.isArray(value) ? value.length > 0 : !blank(value)
}

/** The profile onboarding sends to POST /api/onboarding/confirm; the resume's experience and projects come along. */
export function toProfile(a, draft) {
  const roles = list(a.roles)
  const goals = [
    a.situation && `Search so far: ${a.situation}`,
    a.where && `Looking in: ${a.where}`,
    a.time && `Time per week: ${a.time}`,
    roles.includes(NOT_SURE) && 'Not sure which role yet',
  ].filter(Boolean)
  const picked = list(a.skills).map((name) => ({ name, source: 'self-reported' }))
  const school = a.school?.school?.trim()
  const profile = {
    headline: a.stage,
    targetRoles: roles.filter((r) => r !== NOT_SURE),
    goals,
    skills: picked,
    education: school
      ? [{ school, program: a.school.program?.trim() || undefined, expectedGraduation: a.school.graduation?.trim() || undefined }]
      : [],
  }
  if (!draft) return profile
  const draftSkills = draft.skills ?? []
  return {
    ...profile,
    experience: draft.experience ?? [],
    projects: draft.projects ?? [],
    certifications: draft.certifications ?? [],
    skills: [
      ...draftSkills.filter((s) => picked.some((p) => sameText(p.name, s.name))),
      ...picked.filter((p) => !draftSkills.some((s) => sameText(s.name, p.name))),
    ],
  }
}

const ROLE_HINTS = [
  [/data scien|machine learning|\bml\b|\bai\b/i, 'Data scientist / AI'],
  [/data analy/i, 'Data analyst'],
  [/\bux\b|\bui\b|product design/i, 'UX / UI designer'],
  [/product manag/i, 'Product manager'],
  [/security|cyber/i, 'Cybersecurity'],
  [/it support|help ?desk|technician/i, 'IT support'],
  [/\bweb\b|front.?end/i, 'Web developer'],
  [/software|developer|engineer|programmer|back.?end|full.?stack/i, 'Software developer'],
]

function matchRole(role) {
  const exact = optionsOf('roles').find((o) => sameText(o, role))
  return exact ?? ROLE_HINTS.find(([re]) => re.test(role))?.[1] ?? role
}

/** Pre-selected answers from a resume draft: only what the resume clearly says; the rest stays blank. */
export function draftToAnswers(draft = {}) {
  const answers = {}
  const edu = (draft.education ?? [])[0]
  if (edu) {
    if (/high school|secondary/i.test(edu.school)) answers.stage = 'High school'
    else if (edu.expectedGraduation) answers.stage = 'University or college'
    answers.school = { school: edu.school ?? '', program: edu.program ?? '', graduation: edu.expectedGraduation ?? edu.year ?? '' }
  }
  const roles = [...new Set((draft.targetRoles ?? []).map(matchRole))].slice(0, 3)
  if (roles.length) answers.roles = roles
  const skills = [...new Set((draft.skills ?? []).map((s) => optionsOf('skills').find((o) => sameText(o, s.name)) ?? s.name))].slice(0, 20)
  if (skills.length) answers.skills = skills
  return answers
}
