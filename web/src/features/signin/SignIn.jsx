// SignInView.swift: one screen, three steps. Choose how to sign in, type an email, type the six-digit code.
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { supabase } from '../../lib/supabase'
import { Spinner, TextButton } from '../../ui/Button'
import { Ambient } from '../../app/Shell'
import './signin.css'

const APPLE = import.meta.env.VITE_APPLE_SIGNIN === '1'
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

const COPY = {
  choosing: ['Your next role, one step at a time.', "Raven learns what you've done and plans the shortest path to the job you want."],
  email: ["What's your email?", "We'll send you a six-digit code. No password to remember."],
  code: ['Check your inbox.', null],
}

const offline = (e) => e?.status === 0 || e?.name === 'AuthRetryableFetchError' || !navigator.onLine

export default function SignIn() {
  const [params] = useSearchParams()
  // coming from the landing page's Sign in / Get started, the email step is where they meant to go
  const [step, setStep] = useState(params.get('mode') ? 'email' : 'choosing')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const typedEmail = email.trim()
  const validEmail = EMAIL.test(typedEmail)
  const digits = code.replace(/\D/g, '')
  const validCode = digits.length === 6

  async function attempt(failure, work) {
    setBusy(true)
    setError(null)
    try {
      const { error: e } = await work()
      if (e) throw e
      return true
    } catch (e) {
      setError(offline(e) ? "You're offline. Check your connection and try again." : failure)
      return false
    } finally {
      setBusy(false)
    }
  }

  const sendCode = async () => {
    const sent = await attempt("Raven couldn't send a code to that address. Try again in a minute.", () =>
      supabase.auth.signInWithOtp({ email: typedEmail, options: { shouldCreateUser: true } }),
    )
    if (sent) {
      setCode('')
      setStep('code')
    }
  }

  // on success the auth listener in AppProvider moves the app on
  const verify = () =>
    attempt("That code didn't work. Check it, or ask for a new one.", () =>
      supabase.auth.verifyOtp({ email: typedEmail, token: digits, type: 'email' }),
    )

  const apple = () =>
    attempt("Raven couldn't sign you in with Apple. Try again or use your email.", () =>
      supabase.auth.signInWithOAuth({ provider: 'apple', options: { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` } }),
    )

  const go = (next) => {
    setError(null)
    setStep(next)
  }

  const [headline, subtitle] = COPY[step]
  return (
    <div className="signin">
      <Ambient />
      <div className="signin__panel">
        <a className="signin__brand" href="/">
          <span className="sidebar__mark" aria-hidden>
            R
          </span>
          <span className="sidebar__word">raven</span>
        </a>

        <div className="signin__copy" key={step}>
          <h1 className="t-large-title">{headline}</h1>
          <p className="t-body c-2">{subtitle ?? `Enter the code we sent to ${typedEmail}.`}</p>
        </div>

        <div className="signin__actions">
          {step === 'choosing' && (
            <>
              {APPLE && (
                <button type="button" className="signin__apple" onClick={apple} disabled={busy}>
                  <AppleLogo /> Continue with Apple
                </button>
              )}
              {APPLE ? (
                <TextButton onClick={() => go('email')} className="signin__wide">
                  Use email instead
                </TextButton>
              ) : (
                <button type="button" className="glass-prominent signin__wide" onClick={() => go('email')}>
                  Continue with email
                </button>
              )}
            </>
          )}

          {step === 'email' && (
            <form
              className="signin__form"
              onSubmit={(e) => {
                e.preventDefault()
                if (validEmail && !busy) sendCode()
              }}
            >
              <input
                className="field field--capsule"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                aria-label="Email"
              />
              <button type="submit" className="glass-prominent signin__wide" disabled={!validEmail || busy}>
                {busy ? <Spinner /> : 'Send code'}
              </button>
              <TextButton onClick={() => go('choosing')} className="signin__wide">
                Back
              </TextButton>
            </form>
          )}

          {step === 'code' && (
            <form
              className="signin__form"
              onSubmit={(e) => {
                e.preventDefault()
                if (validCode && !busy) verify()
              }}
            >
              <input
                className="field field--capsule signin__code mono"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={6}
                value={digits}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
                aria-label="Six-digit code"
              />
              <button type="submit" className="glass-prominent signin__wide" disabled={!validCode || busy}>
                {busy ? <Spinner /> : 'Sign in'}
              </button>
              <TextButton onClick={() => go('email')} className="signin__wide">
                Use a different email
              </TextButton>
            </form>
          )}

          {error && (
            <p className="signin__error t-footnote" role="alert">
              <strong>Couldn&rsquo;t sign in.</strong> {error}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function AppleLogo() {
  return (
    <svg width="17" height="20" viewBox="0 0 17 20" aria-hidden>
      <path
        fill="currentColor"
        d="M14.1 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.8 1.2 1.8 2.6 3.1 2.5 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.5-1-2.5-3.9ZM11.6 3c.7-.8 1.2-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4Z"
      />
    </svg>
  )
}
