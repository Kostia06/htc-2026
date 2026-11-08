// The Skillit Worker, as seen from the headset. Pairing, token refresh, the
// phone-to-headset launch queue and the profile. The voice endpoints live in
// src/interview/session.js so this file stays about identity.
//
// A HeadsetSession is exactly what POST /api/pairing/claim answers with:
//   { token, expiresAt, refreshToken, refreshExpiresAt, deviceId, deviceName }

export const API_URL = (
  import.meta.env?.VITE_RAVEN_API_URL ?? 'https://htc-mentor.ilnkostia-dev.workers.dev'
).replace(/\/+$/, '')

export const LONG_POLL_SECONDS = 20

// The one problem vocabulary the keypad reasons about.
//   wrong        -> 4xx, the code did not match: shake, let them retry
//   rate_limited -> 429: tell them to wait a minute
//   offline / unavailable -> nothing to do with the code they typed
export class ClaimError extends Error {
  constructor(problem) {
    super(`claim failed: ${problem}`)
    this.problem = problem
  }
}

// The server no longer knows this headset: back to the keypad.
export class SignedOutError extends Error {}

export class NetworkError extends Error {
  constructor(problem) {
    super(`request failed: ${problem}`)
    this.problem = problem
  }
}

export async function callApi(path, init = {}, fetchImpl = globalThis.fetch) {
  try {
    return await fetchImpl(`${API_URL}${path}`, init)
  } catch (error) {
    if (init.signal?.aborted) throw error
    throw new NetworkError(globalThis.navigator?.onLine === false ? 'offline' : 'unavailable')
  }
}

const json = (body) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

export function claimProblemFor(status) {
  if (status === 429) return 'rate_limited'
  return status >= 400 && status < 500 ? 'wrong' : 'unavailable'
}

export async function claimCode(code, fetchImpl) {
  const response = await callApi('/api/pairing/claim', json({ code }), fetchImpl)
  if (!response.ok) throw new ClaimError(claimProblemFor(response.status))
  return response.json()
}

export function problemOf(error) {
  if (error instanceof ClaimError || error instanceof NetworkError) return error.problem
  return 'unavailable'
}

export async function refreshSession(refreshToken, fetchImpl) {
  const response = await callApi('/api/headset/refresh', json({ refreshToken }), fetchImpl)
  if (response.status === 401) throw new SignedOutError('this headset needs to sign in again')
  if (!response.ok) throw new NetworkError('unavailable')
  return response.json()
}

// One long poll. Resolves with the launch the phone queued
// ({ mode, companySlug?, role?, stepId? }) or null when the wait ran out.
export async function pollLaunch(session, signal, fetchImpl) {
  const query = new URLSearchParams({ wait: String(LONG_POLL_SECONDS) })
  if (session.deviceId) query.set('device', session.deviceId)
  const response = await callApi(
    `/api/headset/launch?${query}`,
    { headers: { authorization: `Bearer ${session.token}` }, signal },
    fetchImpl,
  )
  if (response.status === 401) throw new SignedOutError('this headset needs to sign in again')
  if (!response.ok) throw new NetworkError('unavailable')
  const { launch } = await response.json()
  return launch ?? null
}

// The profile has no display name yet, only a headline and target roles, so
// the greeting falls back to "there" until the server grows one.
export async function fetchProfile(token, fetchImpl) {
  const response = await callApi(
    '/api/me/profile',
    { headers: { authorization: `Bearer ${token}` } },
    fetchImpl,
  )
  if (response.status === 401) throw new SignedOutError('this headset needs to sign in again')
  if (!response.ok) throw new NetworkError('unavailable')
  const { profile } = await response.json()
  return {
    name: profile?.name ?? profile?.displayName ?? null,
    headline: profile?.headline ?? null,
    targetRoles: profile?.targetRoles ?? [],
  }
}
