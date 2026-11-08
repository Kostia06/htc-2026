import { useState } from 'react'
import AuthForm from './auth/AuthForm'
import Dashboard from './dashboard/Dashboard'
import { useSession } from './auth/useSession'
import Onboarding from './onboarding/Onboarding'
import { clearAnswers, loadAnswers } from './onboarding/store'
import './auth/auth.css'

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
    <Dashboard
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
