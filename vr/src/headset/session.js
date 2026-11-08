// Who this headset is signed in as, and when to refresh that. Pure functions
// plus localStorage; the React side is useHeadsetSession.js.
//
// Phases:
//   signedOut    -> show the keypad
//   restoring    -> stored token has expired, refreshing before deciding
//   signedIn     -> token is live
//   reconnecting -> token expired and the refresh could not reach the server;
//                   keep the credential and keep trying, do not drop to the keypad

export const REFRESH_MARGIN_MS = 5 * 60 * 1000
export const RETRY_AFTER_FAILURE_MS = 30_000
const MIN_REFRESH_DELAY_MS = 10_000

// The key the earlier 2D sign-in page used, so a headset that signed in there
// stays signed in after this page replaced it. Do not rename it.
export const STORAGE_KEY = 'raven.headset'

export const isLive = (session, now) => Date.parse(session.expiresAt) > now.getTime()

export function initialState(stored, now) {
  if (!stored) return { phase: 'signedOut' }
  if (isLive(stored, now)) return { phase: 'signedIn', session: stored }
  return stored.refreshToken ? { phase: 'restoring', session: stored } : { phase: 'signedOut' }
}

// How long to wait before refreshing; null when there is nothing to refresh with.
export function refreshDelayMs(session, now) {
  if (!session.refreshToken) return null
  return Math.max(Date.parse(session.expiresAt) - now.getTime() - REFRESH_MARGIN_MS, MIN_REFRESH_DELAY_MS)
}

// outcome: { kind: 'refreshed', session } | { kind: 'rejected' } | { kind: 'unreachable' }
// Only a refresh the server rejected sends the headset back to the keypad.
export function afterRefresh(state, outcome, now) {
  if (outcome.kind === 'refreshed') return { phase: 'signedIn', session: outcome.session }
  if (outcome.kind === 'rejected') return { phase: 'signedOut' }
  if (state.phase === 'signedOut') return state
  return isLive(state.session, now)
    ? { phase: 'signedIn', session: state.session }
    : { phase: 'reconnecting', session: state.session }
}

const isSession = (value) =>
  Boolean(value) &&
  typeof value === 'object' &&
  typeof value.token === 'string' &&
  typeof value.expiresAt === 'string'

const defaultStorage = () => globalThis.localStorage

export function readSession(storage = defaultStorage()) {
  try {
    const parsed = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null')
    return isSession(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function saveSession(session, storage = defaultStorage()) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // Private mode or quota: the session still works for this page load.
  }
}

export function clearSession(storage = defaultStorage()) {
  try {
    storage?.removeItem(STORAGE_KEY)
  } catch {
    // nothing to clear
  }
}
