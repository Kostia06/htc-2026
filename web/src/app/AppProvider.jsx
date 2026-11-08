// AppModel.swift on the web: works out whether to show sign-in, onboarding or the app, and holds the profile
// every tab reads. Phases: starting → signedOut | onboarding | ready | failed.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { profileApi, onUnauthorized } from '../lib/client'
import { clearCache, setCacheOwner } from '../lib/cache'
import { supabase } from '../lib/supabase'
import { AppContext, isEmptyProfile, normalizeProfile } from './context'

export function AppProvider({ children }) {
  const [state, setState] = useState({ phase: 'starting', message: null })
  const [profile, setProfile] = useState(null)
  const [session, setSession] = useState(null)
  const userRef = useRef(null)

  const start = useCallback(async (next) => {
    if (!next) {
      setState({ phase: 'signedOut', message: null })
      return
    }
    setState((s) => (s.phase === 'ready' ? s : { phase: 'starting', message: null }))
    try {
      const fetched = await profileApi.get()
      setProfile(normalizeProfile(fetched))
      setState({ phase: isEmptyProfile(fetched) ? 'onboarding' : 'ready', message: null })
    } catch (e) {
      if (e.status === 401) return
      setState({ phase: 'failed', message: e.message })
    }
  }, [])

  const signOut = useCallback(async () => {
    clearCache()
    userRef.current = null
    setProfile(null)
    setSession(null)
    setState({ phase: 'signedOut', message: null })
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
  }, [])

  useEffect(() => {
    onUnauthorized(() => signOut())
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      // supabase-js warns against awaiting its own calls inside this callback, so the work runs just after it
      setTimeout(() => {
        setSession(next)
        const userId = next?.user?.id ?? null
        if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') return
        if (userId === userRef.current && event !== 'INITIAL_SESSION') return
        userRef.current = userId
        setCacheOwner(userId)
        start(next)
      }, 0)
    })
    return () => data.subscription.unsubscribe()
  }, [start, signOut])

  const value = useMemo(
    () => ({
      phase: state.phase,
      message: state.message,
      session,
      email: session?.user?.email ?? null,
      provider: session?.user?.app_metadata?.provider ?? null,
      profile,
      setProfile,
      retry: () => start(session),
      signOut,
      finishOnboarding: (saved) => {
        if (saved) setProfile(normalizeProfile(saved))
        setState({ phase: 'ready', message: null })
      },
      refreshProfile: async () => {
        const fetched = await profileApi.get()
        setProfile(normalizeProfile(fetched))
        return fetched
      },
    }),
    [state, session, profile, start, signOut],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
