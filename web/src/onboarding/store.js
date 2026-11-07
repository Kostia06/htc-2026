import { api } from '../lib/api'
import { supabase } from '../lib/supabase'
import { QUESTIONS } from './questions'

// Answers stay on this device (local memory) and are also sent to the user's profile on the server,
// which stores it encrypted, so the plan and the agent can use them.
const key = (userId) => `raven-onboarding:${userId}`

export function loadAnswers(userId) {
  try {
    return JSON.parse(localStorage.getItem(key(userId)) ?? 'null')
  } catch {
    return null
  }
}

export function saveAnswers(userId, answers) {
  try {
    localStorage.setItem(key(userId), JSON.stringify({ ...answers, completedAt: new Date().toISOString() }))
  } catch {
    // private mode or full storage: the server copy still works
  }
}

export function clearAnswers(userId) {
  try {
    localStorage.removeItem(key(userId))
  } catch {
    // nothing to clear
  }
}

const list = (value) => (Array.isArray(value) ? value : value ? [value] : [])
const optionsOf = (id) => QUESTIONS.find((q) => q.id === id).options

/** Maps the answers onto the server's profile fields (see server/src/memory/profile/types.ts). */
export function toProfilePatch(a) {
  const roles = list(a.roles).filter((r) => r !== 'Not sure yet')
  const goals = [
    a.situation && `Search so far: ${a.situation}`,
    a.where && `Looking in: ${a.where}`,
    a.time && `Time per week: ${a.time}`,
    list(a.roles).includes('Not sure yet') && 'Not sure which role yet',
  ].filter(Boolean)
  const school = a.school?.school?.trim()
  return {
    headline: a.stage,
    targetRoles: roles,
    goals,
    skills: list(a.skills).map((name) => ({ name, source: 'self-reported' })),
    education: school
      ? [{ school, program: a.school.program?.trim() || undefined, expectedGraduation: a.school.graduation?.trim() || undefined }]
      : [],
  }
}

// --- resume ---------------------------------------------------------------

export const RESUME_ACCEPT = '.pdf,.doc,.docx,.odt,.rtf,.txt,.html,.pptx,image/*'

/** Uploads the file; the server reads it with AI and returns a draft profile. Nothing is saved yet. */
export async function uploadResume(file) {
  const { data } = await supabase.auth.getSession()
  const body = new FormData()
  body.append('file', file)
  const res = await fetch('/api/onboarding/resume', {
    method: 'POST',
    headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` },
    body,
  })
  const json = await res.json().catch(() => ({}))
  if (res.status === 401) throw new Error("the server didn't accept your sign-in")
  if (!res.ok || !json.draft) throw new Error(json.error ?? 'the resume could not be read')
  return json // { documentId, summary, draft, missing }
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

const sameText = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase()

function matchRole(role) {
  const exact = optionsOf('roles').find((o) => sameText(o, role))
  return exact ?? ROLE_HINTS.find(([re]) => re.test(role))?.[1] ?? role
}

/** Turns the AI draft into pre-selected answers. Only what the resume clearly says; the rest stays blank. */
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

/** Saves the profile on the server. Returns null on success, or a short reason. */
export async function syncProfile(answers) {
  const patch = toProfilePatch(answers)
  try {
    if (answers.resume?.documentId) {
      // the resume's experience, projects and certifications come along; the server then forgets the file
      const { draft } = answers.resume
      const profile = {
        ...patch,
        experience: draft.experience ?? [],
        projects: draft.projects ?? [],
        certifications: draft.certifications ?? [],
        skills: [
          ...(draft.skills ?? []).filter((s) => list(answers.skills).some((n) => sameText(n, s.name))),
          ...patch.skills.filter((s) => !(draft.skills ?? []).some((d) => sameText(d.name, s.name))),
        ],
      }
      await api('/api/onboarding/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: answers.resume.documentId, profile }),
      })
    } else {
      await api('/api/me/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    }
    return null
  } catch (e) {
    return e.message.startsWith('401') ? "the server didn't accept your sign-in" : 'the server could not be reached'
  }
}
