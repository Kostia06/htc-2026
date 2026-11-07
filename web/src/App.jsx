import { useEffect, useState } from 'react'
import AuthForm from './auth/AuthForm'
import { useSession } from './auth/useSession'
import { api } from './lib/api'
import { supabase } from './lib/supabase'
import Onboarding from './onboarding/Onboarding'
import { clearAnswers, loadAnswers } from './onboarding/store'
import './auth/auth.css'

const list = (v) => (Array.isArray(v) ? v.join(', ') : v)

function Account({ session, answers, syncProblem, onRedo }) {
  const [server, setServer] = useState('checking…')
  useEffect(() => {
    // any protected route works as a check: 200 means the Worker accepted the Supabase token
    api('/api/me/profile')
      .then(() => setServer('accepted your sign-in'))
      .catch((e) => setServer(e.message.startsWith('401') ? "didn't accept your sign-in (401)" : `not reachable (${e.message})`))
  }, [session.access_token])

  const rows = [
    ['Now', answers.stage],
    ['Studying', [answers.school?.school, answers.school?.program].filter(Boolean).join(', ')],
    ['Target roles', list(answers.roles)],
    ['Search so far', answers.situation],
    ['Skills', list(answers.skills)],
    ['Looking in', answers.where],
    ['Time per week', answers.time],
  ].filter(([, v]) => v)

  return (
    <main className="account">
      <div className="account__card">
        <h1>You're all set{session.user.user_metadata?.full_name ? `, ${session.user.user_metadata.full_name.split(' ')[0]}` : ''}</h1>
        <p>Email: <code>{session.user.email}</code></p>
        <p>Server: <code>{server}</code></p>
        {syncProblem && <p>Your answers are saved on this device, but not on the server yet: {syncProblem}. Use "Edit my answers" to try again.</p>}
        {rows.length > 0 && (
          <dl className="account__answers">
            {rows.map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        )}
        <button className="auth__link" type="button" onClick={onRedo}>Edit my answers</button>
        <button className="auth__submit" type="button" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    </main>
  )
}

function SignedIn({ session }) {
  const userId = session.user.id
  const [answers, setAnswers] = useState(() => loadAnswers(userId))
  const [syncProblem, setSyncProblem] = useState(null)

  if (!answers) {
    return (
      <Onboarding
        session={session}
        onDone={(final, problem) => {
          setSyncProblem(problem)
          setAnswers(final)
        }}
      />
    )
  }
  return (
    <Account
      session={session}
      answers={answers}
      syncProblem={syncProblem}
      onRedo={() => {
        clearAnswers(userId)
        setAnswers(null)
      }}
    />
  )
}

export default function App() {
  const session = useSession()
  if (session === undefined) return null
  return session ? <SignedIn key={session.user.id} session={session} /> : <AuthForm />
}
