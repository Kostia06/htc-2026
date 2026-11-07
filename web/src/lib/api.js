import { supabase } from './supabase'

// Calls the Worker with the signed-in user's access token; /api is proxied to it in dev (vite.config.js).
export async function api(path, options = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const headers = new Headers(options.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(path, { ...options, headers })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return res.json()
}
