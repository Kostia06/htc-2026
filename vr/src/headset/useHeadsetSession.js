import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SignedOutError, claimCode, fetchProfile, problemOf, refreshSession } from './api.js'
import {
  RETRY_AFTER_FAILURE_MS,
  afterRefresh,
  clearSession,
  initialState,
  readSession,
  refreshDelayMs,
  saveSession,
} from './session.js'

// Restores the stored sign-in on load, refreshes it silently before it expires,
// and owns the claim/sign-out actions the keypad and overlay call.
//
// Returns { phase, session, token, profile, signedInAt, claim, signOut }
//   claim(code) -> resolves to null on success, else a problem string the
//                  keypad turns into a message (see keypad.js messageFor).
//   signedInAt  -> when a code was claimed during this page load, so the
//                  scene can greet; null for a restored session.
export function useHeadsetSession() {
  const [state, setState] = useState(() => initialState(readSession(), new Date()))
  const [profile, setProfile] = useState(null)
  const [signedInAt, setSignedInAt] = useState(null)
  const [attempt, setAttempt] = useState(0) // bumps so an unreachable refresh is retried
  const stateRef = useRef(state)
  stateRef.current = state

  const signOut = useCallback(() => {
    clearSession()
    setProfile(null)
    setSignedInAt(null)
    setState({ phase: 'signedOut' })
  }, [])

  const adopt = useCallback((session) => {
    saveSession(session)
    setState({ phase: 'signedIn', session })
  }, [])

  // Refresh on load when expired, and five minutes before every expiry.
  // Unreachable servers retry; only a rejection drops to the keypad.
  const session = state.phase === 'signedOut' ? null : state.session
  useEffect(() => {
    if (!session) return undefined
    const now = new Date()
    const delay = state.phase === 'signedIn' ? refreshDelayMs(session, now) : 0
    if (delay == null) return undefined

    let cancelled = false
    const timer = setTimeout(async () => {
      let outcome
      try {
        outcome = { kind: 'refreshed', session: await refreshSession(session.refreshToken) }
      } catch (error) {
        outcome = { kind: error instanceof SignedOutError ? 'rejected' : 'unreachable' }
      }
      if (cancelled) return
      const next = afterRefresh(stateRef.current, outcome, new Date())
      if (next.phase === 'signedIn' && outcome.kind === 'refreshed') saveSession(next.session)
      if (next.phase === 'signedOut') clearSession()
      setState(next)
      setAttempt(outcome.kind === 'unreachable' ? (n) => n + 1 : 0)
    }, state.phase === 'reconnecting' || attempt > 0 ? RETRY_AFTER_FAILURE_MS : delay)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [session, state.phase, attempt])

  // The profile is only for the greeting; failing to load it is not a sign-out.
  const token = session?.token ?? null
  useEffect(() => {
    if (!token) return undefined
    let cancelled = false
    fetchProfile(token)
      .then((p) => !cancelled && setProfile(p))
      .catch((error) => {
        if (!cancelled && error instanceof SignedOutError) signOut()
      })
    return () => {
      cancelled = true
    }
  }, [token, signOut])

  const claim = useCallback(
    async (code) => {
      try {
        const claimed = await claimCode(code)
        adopt(claimed)
        setSignedInAt(Date.now())
        return null
      } catch (error) {
        return problemOf(error)
      }
    },
    [adopt],
  )

  return useMemo(
    () => ({ phase: state.phase, session, token, profile, signedInAt, claim, signOut }),
    [state.phase, session, token, profile, signedInAt, claim, signOut],
  )
}
