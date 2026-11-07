import { useEffect, useState } from 'react'
import AuthForm from './auth/AuthForm'
import { useSession } from './auth/useSession'
import { api } from './lib/api'
import { supabase } from './lib/supabase'
import './auth/auth.css'

function Account({ session }) {
  const [server, setServer] = useState('checking…')
  useEffect(() => {
    api('/api/me')
      .then((me) => setServer(`signed in as ${me.id} (via ${me.via})`))
      .catch((e) => setServer(`not reachable (${e.message})`))
  }, [session.access_token])

  return (
    <main className="account">
      <div className="account__card">
        <h1>You're signed in</h1>
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
