// VoiceSessionView.swift + VoiceSessionModel.swift, full screen at /practice/session. Gets a session from the
// server, runs the spoken interview, scores each answer in the background as it lands, then shows the debrief.
// If the microphone is blocked, the same planned questions are answered by typing.
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { CircleCheck, UsersRound, AudioWaveform } from 'lucide-react'
import { Ambient } from '../../app/Shell'
import { roadmapApi, voiceApi } from '../../lib/client'
import { withoutAudioTags } from '../../lib/format'
import { MicDenied, startVoice, TranscriptTurns } from '../../lib/voice'
import { RaisedButton } from '../../ui/Button'
import { ContentUnavailable, ThinProgressBar } from '../../ui/Feedback'
import SessionSummary from './SessionSummary'
import VoiceBar from './VoiceBar'
import './practice.css'

const STATE_LABEL = { connecting: 'Connecting…', listening: 'Your turn', speaking: 'Speaking', thinking: 'Thinking' }

/** The agent rarely reads a question back word for word, so tags, case, punctuation and lead-ins are ignored. */
const comparable = (text) =>
  withoutAudioTags(text)
    .toLowerCase()
    .replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, '')

function plannedIndex(questions, spoken) {
  const s = comparable(spoken)
  if (!s) return -1
  return questions.findIndex((q) => {
    const p = comparable(q.text)
    return p && (s === p || s.endsWith(p) || s.startsWith(p))
  })
}

/** Keyed by location so "Practice again" starts fresh. */
export default function VoiceSessionRoute() {
  const location = useLocation()
  return <VoiceSession key={location.key} />
}

function VoiceSession() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const request = { companySlug: params.get('company') || undefined, role: params.get('role') || undefined, difficulty: params.get('difficulty') || undefined }
  const stepId = params.get('step')

  const [phase, setPhase] = useState('live') // live | typed | wrappingUp | finished | failed
  const [message, setMessage] = useState(null)
  const [voiceState, setVoiceState] = useState('connecting')
  const [question, setQuestion] = useState(null)
  const [questionNumber, setQuestionNumber] = useState(null)
  const [questionCount, setQuestionCount] = useState(0)
  const [company, setCompany] = useState(null)
  const [tip, setTip] = useState(null)
  const [scored, setScored] = useState(0)
  const [debrief, setDebrief] = useState(null)
  const [hasStarted, setHasStarted] = useState(false)
  // the report's replay is looked up by it; kept in state because the ref can't be read while rendering
  const [sessionId, setSessionId] = useState(null)

  const started = useRef(false)
  const alive = useRef(true)
  const session = useRef(null)
  const voice = useRef(null)
  const transcript = useRef(new TranscriptTurns())
  const scoring = useRef([])
  const wrapping = useRef(false)

  const leave = () => navigate(stepId ? '/roadmap' : request.companySlug ? `/companies/${request.companySlug}` : '/practice', { replace: true })

  const submit = (turn) => {
    const id = session.current?.sessionId
    if (!id) return
    scoring.current.push(
      voiceApi
        .turn(id, turn)
        .then((feedback) => {
          if (!alive.current) return
          setScored((n) => n + 1)
          if (feedback?.tip) setTip(feedback.tip)
        })
        // a turn that fails to score only loses its tip; the conversation carries on
        .catch(() => {}),
    )
  }

  const wrapUp = async () => {
    if (wrapping.current) return
    wrapping.current = true
    const last = transcript.current.flush()
    if (last) submit(last)
    if (!scoring.current.length) {
      // ended before any answer: nothing to sum up
      if (alive.current) leave()
      return
    }
    setPhase('wrappingUp')
    await Promise.all(scoring.current)
    try {
      const result = await voiceApi.finish(session.current.sessionId)
      if (!alive.current) return
      setDebrief(result)
      setPhase('finished')
      // a session that reached its summary counts as the roadmap step done
      if (stepId) roadmapApi.setStatus(stepId, 'done', `Scored ${result.overall}/100. ${result.verdict}`.slice(0, 160)).catch(() => {})
    } catch (e) {
      if (!alive.current) return
      setMessage(e.message)
      setPhase('failed')
    }
  }

  const showQuestion = (line) => {
    const spoken = withoutAudioTags(line)
    if (!spoken) return
    const questions = session.current?.questions ?? []
    const index = plannedIndex(questions, spoken)
    if (index >= 0) {
      setQuestion(questions[index])
      setQuestionNumber(index + 1)
    } else setQuestion({ text: spoken })
  }

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      voice.current?.stop()
    }
  }, [])

  useEffect(() => {
    if (started.current) return
    started.current = true
    ;(async () => {
      let started_
      try {
        started_ = await voiceApi.start(request)
      } catch (e) {
        setMessage(e.status === 503 ? `${e.message}. Voice practice needs the server's ElevenLabs agents; there's no offline voice.` : e.message)
        setPhase('failed')
        return
      }
      if (!alive.current) return
      session.current = started_
      setHasStarted(true)
      setSessionId(started_.sessionId)
      setCompany(started_.company ?? null)
      setQuestionCount(started_.questions?.length ?? 0)
      try {
        voice.current = await startVoice(started_.credentials, {
          state: (s) => alive.current && setVoiceState(s),
          line: (speaker, text) => {
            if (!alive.current) return
            if (speaker === 'agent') showQuestion(text)
            const turn = transcript.current.add(speaker, text)
            if (turn) submit(turn)
          },
          // without this link there is no replay, but the interview itself carries on regardless
          conversation: (conversationId) => voiceApi.attachConversation(started_.sessionId, conversationId).catch(() => {}),
          ended: () => alive.current && wrapUp(),
          failed: (msg) => {
            if (!alive.current) return
            setMessage(msg)
            setPhase('failed')
            voice.current?.stop()
          },
        })
        if (!alive.current) voice.current.stop()
      } catch (e) {
        if (!alive.current) return
        if (e instanceof MicDenied && started_.questions?.length) {
          setPhase('typed')
          setQuestion(started_.questions[0])
          setQuestionNumber(1)
        } else {
          setMessage(e.message)
          setPhase('failed')
        }
      }
    })()
    // runs once per mount; "Practice again" remounts with a new key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // a tip shows for five seconds
  useEffect(() => {
    if (!tip) return undefined
    const t = setTimeout(() => setTip(null), 5000)
    return () => clearTimeout(t)
  }, [tip])

  const end = () => {
    if (!hasStarted) return leave()
    if (phase === 'typed') return wrapUp()
    voice.current ? voice.current.stop() : wrapUp()
  }

  const again = () => navigate(`/practice/session?${params}`, { replace: true })

  if (phase === 'failed')
    return (
      <div className="cover">
        <Ambient />
        <ContentUnavailable icon={AudioWaveform} title="Practice stopped" description={message}>
          <button type="button" className="glass-prominent" style={{ width: '100%' }} onClick={leave}>
            Close
          </button>
        </ContentUnavailable>
      </div>
    )

  if (phase === 'wrappingUp' || phase === 'finished')
    return (
      <div className="cover">
        <Ambient />
        <SessionSummary debrief={debrief} sessionId={sessionId} onAgain={again} onDone={leave} />
      </div>
    )

  return (
    <div className="cover">
      <Ambient />
      <div className="voice">
        <div className="row voice__top">
          <span className="t-caption medium c-agent row voice__scored" style={{ opacity: scored ? 1 : 0 }}>
            <CircleCheck size={14} strokeWidth={2.4} aria-hidden /> {scored} scored
          </span>
          <button type="button" className="glass-button" onClick={end}>
            End
          </button>
        </div>

        <div className="voice__progress" style={{ opacity: questionCount ? 1 : 0 }}>
          <span className="t-caption medium c-2">{questionNumber ? `Question ${questionNumber} of ${questionCount}` : `${questionCount} questions`}</span>
          <ThinProgressBar value={questionNumber ? questionNumber / questionCount : 0} label="Interview progress" />
        </div>

        <div className="voice__question">
          {question?.source === 'reported' && (
            <span className="t-caption medium c-agent row voice__reported">
              <UsersRound size={13} strokeWidth={2.4} aria-hidden /> {company ? `Asked recently at ${company}` : 'Asked recently in real interviews'}
            </span>
          )}
          <h1 className="t-title voice__question-text" key={question?.text}>
            {question?.text ?? ''}
          </h1>
        </div>

        {phase === 'typed' ? (
          <TypedAnswer
            key={questionNumber}
            isLast={questionNumber >= questionCount}
            onAnswer={(answer, durationMs) => {
              submit({ question: question.text, answer, durationMs })
              const questions = session.current.questions
              if (questionNumber >= questions.length) wrapUp()
              else {
                setQuestion(questions[questionNumber])
                setQuestionNumber(questionNumber + 1)
              }
            }}
          />
        ) : (
          <>
            <VoiceBar state={voiceState} level={() => voice.current?.level() ?? 0} />
            <p className="t-footnote medium c-2 voice__state">{STATE_LABEL[voiceState]}</p>
          </>
        )}

        <p className="t-callout c-2 voice__tip" key={tip ?? 'none'}>
          {tip ?? ''}
        </p>
      </div>
    </div>
  )
}

/** The microphone was blocked: the same questions, answered by typing. */
function TypedAnswer({ isLast, onAnswer }) {
  const [text, setText] = useState('')
  const [startedAt] = useState(() => Date.now())
  return (
    <form
      className="typed-answer"
      onSubmit={(e) => {
        e.preventDefault()
        if (text.trim()) onAnswer(text.trim(), Math.max(Date.now() - startedAt, 2000))
      }}
    >
      <p className="t-footnote c-2">The microphone is blocked, so type your answer instead.</p>
      <textarea className="field" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Your answer" autoFocus aria-label="Your answer" />
      <RaisedButton type="submit" disabled={!text.trim()}>
        {isLast ? 'Finish' : 'Next question'}
      </RaisedButton>
    </form>
  )
}
