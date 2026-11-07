import { useEffect, useState } from 'react'
import AuthForm from './auth/AuthForm'
import { useSession } from './auth/useSession'
import { api } from './lib/api'
import { supabase } from './lib/supabase'
import './auth/auth.css'

function Account({ session }) {
  const [server, setServer] = useState('checking…')
  useEffect(() => {
    // any protected route works as a check: 200 means the Worker accepted the Supabase token
    api('/api/me/profile')
      .then(() => setServer('accepted your sign-in'))
      .catch((e) => setServer(`not reachable (${e.message})`))
  }, [session.access_token])

  return (
    <main className="account">
      <div className="account__card">
        <h1>You're signed in</h1>
        <p>Name: <code>{session.user.user_metadata?.full_name || '(not set)'}</code></p>
        <p>Email: <code>{session.user.email}</code></p>
        <p>Server: <code>{server}</code></p>
        <button className="auth__submit" type="button" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    </main>
  )
}

export default function App() {
  const session = useSession()
  if (session === undefined) return null
  return session ? <Account session={session} /> : <AuthForm />
}
