// The Worker's API, one function per endpoint, the same set the iOS app's SkillitClient calls.
// Every call carries the Supabase access token; a 401 signs the person out, as on iOS.
import { supabase } from './supabase'

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

// the messages SkillitError.swift shows
const SIGNED_OUT = 'You were signed out. Sign in again to continue.'
const OFFLINE = "You're offline. Check your connection and try again."
const UNREADABLE = 'Something went wrong on our side. Try again in a moment.'

const sentence = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text)

let unauthorized = () => {}
/** The app registers what a 401 does (sign out) once it starts. */
export function onUnauthorized(fn) {
  unauthorized = fn
}

async function send(path, { method = 'GET', body, form, query, timeout } = {}) {
  const { data } = await supabase.auth.getSession()
  const headers = new Headers()
  const token = data.session?.access_token
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (body !== undefined) headers.set('Content-Type', 'application/json')
  const params = query ? new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '')) : null
  const url = params && [...params].length ? `${path}?${params}` : path
  const controller = timeout ? new AbortController() : null
  const timer = controller ? setTimeout(() => controller.abort(), timeout) : null
  try {
    return await fetch(url, {
      method,
      headers,
      body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
      signal: controller?.signal,
    })
  } catch {
    throw new ApiError(0, OFFLINE)
  } finally {
    clearTimeout(timer)
  }
}

async function request(path, options) {
  const res = await send(path, options)
  if (res.status === 401) {
    unauthorized()
    throw new ApiError(401, SIGNED_OUT)
  }
  if (res.status === 204) return null
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, sentence(json?.error) ?? "That didn't work. Try again.")
  if (json === null) throw new ApiError(res.status, UNREADABLE)
  return json
}

const post = (path, body, options) => request(path, { method: 'POST', body: body ?? {}, ...options })

function upload(path, file) {
  const form = new FormData()
  form.append('file', file)
  return request(path, { method: 'POST', form })
}

export const profileApi = {
  get: () => request('/api/me/profile').then((r) => r.profile),
  /** lists are merged in; `remove` takes entries out first (ProfilePatch) */
  patch: (patch) => request('/api/me/profile', { method: 'PATCH', body: patch }).then((r) => r.profile),
  /** removes everything Skillit keeps about the person */
  eraseAll: () => request('/api/me', { method: 'DELETE' }),
}

/** the files the server can read a resume from (5 MB at most) */
export const RESUME_ACCEPT = '.pdf,.doc,.docx,.odt,.rtf,.txt,.md,.html,.pptx,image/*'
export const RESUME_MAX_BYTES = 5 * 1024 * 1024

export const onboardingApi = {
  /** { documentId, summary, draft, missing, droppedClaims }; nothing is saved yet */
  uploadResume: (file) => upload('/api/onboarding/resume', file),
  confirm: (documentId, profile) => post('/api/onboarding/confirm', { documentId, profile }).then((r) => r.profile),
}

export const roadmapApi = {
  /** { goal, progress: { done, total, streakDays }, next, nextCursor, completed: [{ day, steps }] } */
  page: (cursor) => request('/api/roadmap', { query: { cursor, tz: Intl.DateTimeFormat().resolvedOptions().timeZone } }),
  setStatus: (id, status, note) => post(`/api/roadmap/steps/${id}`, { status, note: note || undefined }),
}

export const feedApi = {
  /** { items, nextCursor, building, section } */
  page: (section = 'all', cursor) => request('/api/feed', { query: { section, cursor }, timeout: 15000 }),
  act: (cardId, action) => post(`/api/feed/items/${cardId}`, { action }, { timeout: 15000 }),
}

export const voiceApi = {
  /** { sessionId, credentials, opening, role, company, questions } */
  start: ({ companySlug, role, difficulty }) =>
    post('/api/voice/sessions', { mode: 'interview', companySlug: companySlug || undefined, role: role || undefined, difficulty }),
  turn: (id, turn) => post(`/api/voice/sessions/${id}/turns`, turn),
  finish: (id) => post(`/api/voice/sessions/${id}/finish`, { platform: 'app' }),
  history: (cursor) => request('/api/voice/history', { query: { cursor } }),
  session: (id) => request(`/api/voice/sessions/${id}`),
}

export const companiesApi = {
  list: () => request('/api/companies').then((r) => r.companies),
  insights: (slug) => request(`/api/memory/${slug}`),
  /** 429 when it was researched in the last half hour */
  research: (slug) => post(`/api/research/${slug}`),
}

export const memoriesApi = {
  list: () => request('/api/me/memories').then((r) => r.memories),
  forget: (id) => request(`/api/me/memories/${id}`, { method: 'DELETE' }),
  share: (id, companySlug, role) => post(`/api/me/memories/${id}/share`, { companySlug, role }),
}

export const resumeApi = {
  /** { resume, saved } */
  load: () => request('/api/resume'),
  save: (resume) => request('/api/resume', { method: 'PUT', body: resume }).then((r) => r.resume),
  /** coach rewrites for `resume` as it is on screen (saved or not), optionally one section and tuned to a company */
  improve: ({ resume, section, company } = {}) =>
    post('/api/resume/improve', { resume, section: section || undefined, company: company || undefined }).then((r) => r.suggestions ?? []),
  /** reads a file into a resume that is not saved yet: { resume, saved: false, droppedClaims } */
  upload: (file) => upload('/api/resume/upload', file),
  pdf: async () => {
    const res = await send('/api/resume/pdf')
    if (res.status === 401) {
      unauthorized()
      throw new ApiError(401, SIGNED_OUT)
    }
    if (!res.ok) throw new ApiError(res.status, "The PDF couldn't be made. Try again.")
    return res.blob()
  },
}

/** { reply, needsAnswer, applied: [{ type, summary }] } */
export const sendUpdate = (message, conversation) => post('/api/updates', { message, conversation })

export const recapApi = {
  /** { reply, done, extracted, shared } */
  turn: (companySlug, message, history) => post('/api/recap', { companySlug: companySlug || undefined, message, history }),
  startVoice: (companySlug) => post('/api/recap/voice', { companySlug: companySlug || undefined }),
  finishVoice: (id, transcript) => post(`/api/recap/voice/${id}/finish`, { transcript }),
}

export const headsetApi = {
  /** { connected, devices: [{ id, name, createdAt, lastSeenAt, connected }] } */
  status: () => request('/api/headset/status'),
  launch: ({ companySlug, role, stepId }) => post('/api/headset/launch', { mode: 'interview', companySlug, role, stepId }),
  revoke: (id) => request(`/api/headset/devices/${id}`, { method: 'DELETE' }),
}

export const pairingApi = {
  /** { code, expiresAt } */
  offer: () => post('/api/pairing/offer'),
  /** waiting | claimed | expired */
  status: (code) => request(`/api/pairing/offer/${code}`).then((r) => r.status),
}

/** Only plain web links; anything else is shown as text. */
export const safeUrl = (url) => (typeof url === 'string' && /^https?:\/\//i.test(url) ? url : null)

export const hostOf = (url) => {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return null
  }
}
