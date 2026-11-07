import { useState } from 'react'
import { supabase } from '../lib/supabase'
import './auth.css'

const MODES = {
  signIn: { title: 'Sign in', submit: 'Sign in' },
  signUp: { title: 'Create an account', submit: 'Create account' },
  link: { title: 'Email me a sign-in link', submit: 'Send link' },
}

export default function AuthForm() {
  const [mode, setMode] = useState('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const redirect = { emailRedirectTo: window.location.origin }
    const { error } =
      mode === 'signIn'
        ? await supabase.auth.signInWithPassword({ email, password })
        : mode === 'signUp'
          ? await supabase.auth.signUp({ email, password, options: redirect })
          : await supabase.auth.signInWithOtp({ email, options: redirect })
    setBusy(false)
    if (error) return setMessage({ type: 'error', text: error.message })
    if (mode === 'signUp') setMessage({ type: 'ok', text: 'Check your email to confirm your account, then sign in.' })
    if (mode === 'link') setMessage({ type: 'ok', text: 'Check your email for a sign-in link.' })
  }

  const switchTo = (next) => {
    setMode(next)
    setMessage(null)
  }

  return (
    <main className="auth">
      <form className="auth__card" onSubmit={onSubmit} noValidate>
        <h1 className="auth__title">{MODES[mode].title}</h1>

        <label className="auth__field">
          <span>Email</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>

        {mode !== 'link' && (
          <label className="auth__field">
            <span>Password</span>
            <input
              type="password"
              autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
              minLength={6}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}

        <button className="auth__submit" type="submit" disabled={busy || !email || (mode !== 'link' && !password)}>
          {busy ? 'Please wait…' : MODES[mode].submit}
        </button>

        <p className={`auth__message auth__message--${message?.type ?? 'none'}`} role="status" aria-live="polite">
          {message?.text}
        </p>

        <div className="auth__switch">
          {mode !== 'signIn' && <button type="button" onClick={() => switchTo('signIn')}>Have an account? Sign in</button>}
          {mode !== 'signUp' && <button type="button" onClick={() => switchTo('signUp')}>New here? Create an account</button>}
          {mode !== 'link' && <button type="button" onClick={() => switchTo('link')}>Email me a link instead</button>}
        </div>
      </form>
    </main>
  )
}
