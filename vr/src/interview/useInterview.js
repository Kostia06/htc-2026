import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createSession } from './session.js'
import { createListener, createSpeaker } from './speech.js'
import { createVoiceDetector } from './vad.js'

// Phases: idle -> asking -> listening -> scoring -> asking -> ... -> done
// 'awaiting' only happens when there is no microphone and we fall back to a button.
export function useInterview() {
  const session = useMemo(() => createSession(), [])
  const speaker = useMemo(() => createSpeaker(), [])
  const listener = useMemo(() => createListener(), [])

  // The detector is built once, but its callbacks must reach the current
  // handlers, so they bounce through refs rather than closing over stale ones.
  const onSpeechStartRef = useRef(() => {})
  const onSpeechEndRef = useRef(() => {})
  const vad = useMemo(
    () =>
      createVoiceDetector({
        onSpeechStart: () => onSpeechStartRef.current(),
        onSpeechEnd: (reason) => onSpeechEndRef.current(reason),
      }),
    [],
  )

  const [phase, setPhase] = useState('idle')
  const [meta, setMeta] = useState(null)
  const [question, setQuestion] = useState(null)
  const [result, setResult] = useState(null)
  const [resultAt, setResultAt] = useState(0)
  const [summary, setSummary] = useState(null)
  const [transcript, setTranscript] = useState('')
  const [caption, setCaption] = useState('')
  const [speaking, setSpeaking] = useState(false)
  const [speechMs, setSpeechMs] = useState(0)
  const [heard, setHeard] = useState(false)
  const [micDenied, setMicDenied] = useState(false)
  const [error, setError] = useState(null)
  const [muted, setMuted] = useState(false)

  const alive = useRef(true)
  const running = useRef(false)
  const askedRef = useRef(null) // the exact line the candidate is answering
  const answerStartedAt = useRef(0)
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const listenRef = useRef(() => {})
  const agentRef = useRef(null) // the provider's realtime voice agent, when offered

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      running.current = false
      speaker.cancel()
      vad.release()
      agentRef.current?.disconnect()
    }
  }, [speaker, vad])

  const say = useCallback(
    async (text) => {
      if (!text) return
      setCaption(text)
      if (muted) return
      // Resolve the audio first so the mouth is timed to the real clip, not a
      // word-count guess. Quest Browser has no voices, so when neither a clip
      // nor the TTS bridge answers, the clock alone drives the mouth.
      const { ms, play } = await speaker.prepare(text).catch(() => ({ ms: speaker.estimateMs(text), play: async () => {} }))
      if (!alive.current) return
      setSpeechMs(ms)
      setSpeaking(true)
      try {
        await Promise.all([play().catch(() => {}), new Promise((r) => setTimeout(r, ms))])
      } finally {
        if (alive.current) setSpeaking(false)
      }
    },
    [muted, speaker],
  )

  // Open the mic and let the candidate talk. Ends on its own when they stop.
  const listen = useCallback(async () => {
    if (!running.current) return
    setTranscript('')
    setHeard(false)
    answerStartedAt.current = performance.now()
    setPhase('listening')
    if (listener.supported) listener.start((text) => alive.current && setTranscript(text))

    const mic = await vad.start()
    if (!alive.current) return
    if (!mic.ok) {
      setMicDenied(true)
      setError(
        mic.reason === 'denied'
          ? 'Microphone blocked. Allow it, or press the button to answer.'
          : 'No microphone found. Press the button to answer.',
      )
      setPhase('awaiting')
    }
  }, [listener, vad])
  listenRef.current = listen

  // Speak a line, then hand the floor back to the candidate.
  const sayThenListen = useCallback(
    async (text) => {
      askedRef.current = text
      setQuestion(text)
      setPhase('asking')
      await say(text)
      if (alive.current && running.current) await listenRef.current()
    },
    [say],
  )

  const endTurn = useCallback(async () => {
    if (phaseRef.current !== 'listening' && phaseRef.current !== 'awaiting') return
    vad.stop()
    setPhase('scoring')
    const durationMs = performance.now() - answerStartedAt.current
    const spoken = listener.supported ? await listener.stop() : transcript
    if (!alive.current) return
    setTranscript(spoken)

    try {
      const { score, next } = await session.submitAnswer({
        question: askedRef.current ?? '',
        answer: spoken,
        durationMs,
      })
      if (!alive.current || !running.current) return

      if (score) {
        setResult(score)
        setResultAt(Date.now())
      }

      if (next?.kind === 'wrap_up') {
        running.current = false
        setPhase('done')
        await say(next.say)
        const final = await session.finish()
        if (alive.current) setSummary(final)
        return
      }
      await sayThenListen(next?.say ?? '')
    } catch (err) {
      if (!alive.current) return
      setError(err.message ?? 'Lost the connection to the interviewer.')
      setPhase('awaiting')
    }
  }, [listener, say, sayThenListen, session, transcript, vad])

  // The provider's own agent does speech-to-text, the model and speech-out over
  // one socket, so none of our speech stack runs on this path. It is the same
  // agent the phone app uses, so both sound and behave identically.
  const beginWithAgent = useCallback(
    async (started) => {
      const { createElevenLabsSession } = await import('./elevenlabs.js')

      const agent = createElevenLabsSession({
        signedUrl: started.voice.signedUrl,
        // Passed through exactly as the server composed them. Do not inject a
        // firstMessage: this agent's config forbids overriding it and the
        // socket is closed with 1008 the moment you try.
        overrides: started.voice.overrides,
        // The agent's own first message is a template with an {{opening}} slot;
        // without this it refuses the session with 1008. The server composes the
        // line (role, company), so the greeting matches the planned interview.
        dynamicVariables: { opening: started.opening ?? '' },
        onState: (next) => {
          if (!alive.current) return
          if (next === 'reconnecting') setError('Reconnecting…')
          else if (next === 'open') setError(null)
        },
        onAgentText: (text) => {
          if (!alive.current || !text) return
          setCaption(text)
          setQuestion(text)
          askedRef.current = text
        },
        onUserText: (text) => alive.current && setTranscript(text),
        onSpeakingChange: (isSpeaking) => {
          if (!alive.current) return
          setSpeaking(isSpeaking)
          setPhase(isSpeaking ? 'asking' : 'listening')
          if (isSpeaking) setHeard(false)
        },
        onTurn: async ({ question, answer }) => {
          if (!alive.current || !answer) return
          setHeard(true)
          try {
            const score = await session.scoreTurn({ question, answer, durationMs: 0 })
            if (!alive.current || !score) return
            setResult(score)
            setResultAt(Date.now())
          } catch {
            // A missed score costs a panel, not the conversation.
          }
        },
        onError: (err) => {
          if (!alive.current) return
          if (err?.reason === 'denied') {
            setMicDenied(true)
            setError('Microphone blocked. Allow it and start again.')
          }
        },
      })

      agentRef.current = agent
      setPhase('asking')
      await agent.connect()
    },
    [session],
  )

  const begin = useCallback(async () => {
    setError(null)
    setSummary(null)
    setResult(null)
    running.current = true
    try {
      await speaker.unlock()
      const started = await session.start()
      if (!alive.current) return
      setMeta(started)

      if (started.voice?.signedUrl) {
        await beginWithAgent(started)
        return
      }

      setPhase('asking')
      await say(started.opening)
      if (!alive.current || !running.current) return
      await sayThenListen(started.question)
    } catch (err) {
      if (alive.current) {
        setError(err.message ?? 'Could not reach the interviewer.')
        setPhase('idle')
        running.current = false
      }
    }
  }, [beginWithAgent, say, sayThenListen, session, speaker])

  const restart = useCallback(() => {
    running.current = false
    agentRef.current?.disconnect()
    agentRef.current = null
    speaker.cancel()
    vad.stop()
    setPhase('idle')
    setQuestion(null)
    setResult(null)
    setSummary(null)
    setCaption('')
    setTranscript('')
    setError(null)
    setMicDenied(false)
  }, [speaker, vad])

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m
      // Mute the microphone too: a full-duplex agent left listening to a muted
      // room keeps replying to itself and keeps burning quota.
      agentRef.current?.setMuted(next)
      if (next) {
        speaker.cancel()
        setSpeaking(false)
      }
      return next
    })
  }, [speaker])

  useEffect(() => {
    onSpeechStartRef.current = () => alive.current && setHeard(true)
    onSpeechEndRef.current = () => endTurn()
  }, [endTurn])

  // One place that knows what "next" means, so every input path agrees.
  const advance = useCallback(() => {
    const current = phaseRef.current
    if (current === 'idle') begin()
    else if (current === 'listening' || current === 'awaiting') endTurn()
    else if (current === 'done') restart()
  }, [begin, endTurn, restart])

  const actions = useMemo(
    () => ({ begin, advance, startAnswer: listen, stopAnswer: endTurn, restart, toggleMute }),
    [begin, advance, listen, endTurn, restart, toggleMute],
  )

  return {
    phase,
    meta,
    question,
    result,
    resultAt,
    summary,
    transcript,
    caption,
    speaking,
    speechMs,
    heard,
    micDenied,
    error,
    muted,
    isStub: session.isStub === true,
    sttSupported: listener.supported,
    getAmplitude: () => agentRef.current?.getAmplitude() ?? speaker.getAmplitude(),
    micLevel: () => vad.level,
    actions,
  }
}
