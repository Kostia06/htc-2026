import { api } from '../lib/api'

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

/** Sends the answers to the server profile. Returns null on success, or a short reason. */
export async function syncProfile(answers) {
  try {
    await api('/api/me/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toProfilePatch(answers)),
    })
    return null
  } catch (e) {
    return e.message.startsWith('401') ? "the server didn't accept your sign-in" : 'the server could not be reached'
  }
}
