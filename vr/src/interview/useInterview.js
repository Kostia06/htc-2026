import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createSession } from './session.js'
import { createListener, createSpeaker } from './speech.js'

// Phases: idle -> asking -> awaiting -> listening -> scoring -> review -> done
//
// `auth` is optional: { token, onSignedOut }. With a token the questions and
// scores come from the Raven voice API; without one the session falls back to
// whatever createSession picked before (env-selected API or example data).
// The token is read through a ref so a silent refresh mid-interview does not
// rebuild the session and lose its id.
export function useInterview(auth = {}) {
  const { token = null, onSignedOut } = auth
  const tokenRef = useRef(token)
  tokenRef.current = token
  const onSignedOutRef = useRef(onSignedOut)
  onSignedOutRef.current = onSignedOut

  const signedIn = Boolean(token)
  const session = useMemo(
    () =>
      createSession(
        signedIn ? { getToken: () => tokenRef.current, onSignedOut: () => onSignedOutRef.current?.() } : {},
      ),
    [signedIn],
  )
  const speaker = useMemo(() => createSpeaker(), [])
  const listener = useMemo(() => createListener(), [])

  const [phase, setPhase] = useState('idle')
  const [meta, setMeta] = useState(null)
  const [question, setQuestion] = useState(null)
  const [result, setResult] = useState(null)
  const [summary, setSummary] = useState(null)
  const [transcript, setTranscript] = useState('')
  const [caption, setCaption] = useState('')
  const [speaking, setSpeaking] = useState(false)
  const [speechMs, setSpeechMs] = useState(0)
  const [error, setError] = useState(null)
  const [muted, setMuted] = useState(false)

  const answerStartedAt = useRef(0)
  const alive = useRef(true)
  useEffect(() => {
    // Must be set on mount, not just at init: StrictMode mounts, unmounts and
    // remounts, and the cleanup below would otherwise leave this false forever
    // and silently abandon every async continuation.
    alive.current = true
    return () => {
      alive.current = false
      speaker.cancel()
    }
  }, [speaker])

  // Voice the interviewer and hold `speaking` for the duration so the avatar's
  // mouth and the captions stay in step.
  const say = useCallback(
    async (text) => {
      if (!text) return
      setCaption(text)
      if (muted) return

      const words = text.trim().split(/\s+/).filter(Boolean).length
      const spoken = Math.max(1400, words * 360) // ~165 wpm

      setSpeechMs(spoken)
      setSpeaking(true)
      try {
        // Whichever takes longer: real audio, or the time this line should take.
        await Promise.all([
          speaker.speak(text).catch(() => {}),
          new Promise((resolve) => setTimeout(resolve, spoken)),
        ])
      } finally {
        if (alive.current) setSpeaking(false)
      }
    },
    [muted, speaker],
  )

  const ask = useCallback(async () => {
    setPhase('asking')
    setResult(null)
    setTranscript('')
    try {
      const next = await session.nextQuestion()
      if (!alive.current) return
      if (!next) {
        const final = await session.finish()
        if (!alive.current) return
        setSummary(final)
        setPhase('done')
        await say(final.summary)
        return
      }
      setQuestion(next)
      await say(next.text)
      if (alive.current) setPhase('awaiting')
    } catch (err) {
      if (alive.current) {
        setError(err.message ?? 'Could not load the next question.')
        setPhase('awaiting')
      }
    }
  }, [say, session])

  // `launch` is what the phone sent ({ companySlug, role }); the Begin button
  // and the keyboard call this with nothing.
  const begin = useCallback(async (launch) => {
    setError(null)
    setSummary(null)
    setPhase('asking')
    try {
      const started = await session.start(launch && typeof launch === 'object' ? launch : undefined)
      if (!alive.current) return
      setMeta(started)
      await say(
        started.opening ??
          `Thanks for coming in. I have ${started.questionCount} questions about your experience. Take your time.`,
      )
      await ask()
    } catch (err) {
      if (alive.current) {
        setError(err.message ?? 'Could not start the interview.')
        setPhase('idle')
      }
    }
  }, [ask, say, session])

  const startAnswer = useCallback(() => {
    if (phase !== 'awaiting') return
    speaker.cancel()
    setSpeaking(false)
    setTranscript('')
    answerStartedAt.current = performance.now()
    setPhase('listening')
    if (listener.supported) listener.start((text) => alive.current && setTranscript(text))
  }, [listener, phase, speaker])

  const stopAnswer = useCallback(async () => {
    if (phase !== 'listening') return
    const durationMs = performance.now() - answerStartedAt.current
    const spoken = listener.supported ? await listener.stop() : ''
    if (!alive.current) return
    setTranscript(spoken)
    setPhase('scoring')
    try {
      const scored = await session.submitAnswer({
        questionId: question?.id,
        question: question?.text,
        transcript: spoken,
        durationMs,
      })
      if (!alive.current) return
      setResult(scored)
      setPhase('review')
      await say(scored.tip)
    } catch (err) {
      if (alive.current) {
        setError(err.message ?? 'Scoring failed.')
        setPhase('awaiting')
      }
    }
  }, [listener, phase, question, say, session])

  const restart = useCallback(() => {
    speaker.cancel()
    setPhase('idle')
    setQuestion(null)
    setResult(null)
    setSummary(null)
    setCaption('')
    setTranscript('')
    setError(null)
  }, [speaker])

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      if (!m) {
        speaker.cancel()
        setSpeaking(false)
      }
      return !m
    })
  }, [speaker])

  const advance = useCallback(() => {
    if (phase === 'idle') begin()
    else if (phase === 'awaiting') startAnswer()
    else if (phase === 'listening') stopAnswer()
    else if (phase === 'review') ask()
    else if (phase === 'done') restart()
  }, [ask, begin, phase, restart, startAnswer, stopAnswer])

  const actions = useMemo(
    () => ({ begin, ask, advance, startAnswer, stopAnswer, restart, toggleMute }),
    [begin, ask, advance, startAnswer, stopAnswer, restart, toggleMute],
  )

  return {
    phase,
    meta,
    question,
    result,
    summary,
    transcript,
    caption,
    speaking,
    speechMs,
    error,
    muted,
    isStub: session.isStub === true,
    sttSupported: listener.supported,
    getAmplitude: speaker.getAmplitude,
    actions,
  }
}
