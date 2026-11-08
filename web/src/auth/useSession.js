import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/** Current Supabase session: undefined while loading, null when signed out. */
export function useSession() {
  const [session, setSession] = useState(undefined)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])
  return session
}
