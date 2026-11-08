import { supabase } from './supabase'

// Calls to the Worker's AI routes. Errors carry the server's own message so the page can show it as is.
export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const FALLBACK = {
  401: "the server didn't accept your sign-in",
  404: 'not found',
  429: 'too many requests, try again in a little while',
  502: "the AI couldn't finish this one, try again",
  503: "this isn't set up on the server yet",
}

async function request(path, { method = 'GET', body } = {}) {
  const { data } = await supabase.auth.getSession()
  const headers = new Headers()
  const token = data.session?.access_token
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (body !== undefined) headers.set('Content-Type', 'application/json')
  let res
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError(0, 'the server could not be reached')
  }
  if (res.status === 204) return null
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, json?.error ?? FALLBACK[res.status] ?? `the server answered ${res.status}`)
  return json
}

/** Runs one agent skill for the signed-in person and returns its output. */
export async function runSkill(skill, input = {}) {
  const json = await request(`/api/agent/${skill}`, { method: 'POST', body: { platform: 'app', input } })
  return json.output
}

/** Company names become the slugs the server keys companies by: "ATB Financial" → "atb-financial". */
export const toSlug = (name) =>
  name
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const getProfile = () => request('/api/me/profile').then((r) => r.profile)

export const voice = {
  start: (body) => request('/api/voice/sessions', { method: 'POST', body }),
  turn: (id, body) => request(`/api/voice/sessions/${id}/turns`, { method: 'POST', body }),
  finish: (id) => request(`/api/voice/sessions/${id}/finish`, { method: 'POST', body: { platform: 'app' } }),
}

export const memories = {
  list: () => request('/api/me/memories').then((r) => r.memories),
  forget: (id) => request(`/api/me/memories/${id}`, { method: 'DELETE' }),
}

/** Only links that are plain web pages; anything else from the model is shown as text. */
export const safeUrl = (url) => (typeof url === 'string' && /^https?:\/\//i.test(url) ? url : null)
