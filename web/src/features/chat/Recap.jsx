// RecapView.swift + RecapModel.swift: "How it went", typed or spoken. At most two clarifying questions, then the
// card of what Raven understood and whether the questions were shared anonymously.
import { useEffect, useRef, useState } from 'react'
import { HelpCircle, Lock, UsersRound } from 'lucide-react'
import { recapApi } from '../../lib/client'
import { useStickToBottom } from '../../lib/hooks'
import { MicDenied, startVoice } from '../../lib/voice'
import { Bubble, Composer, TypingIndicator } from '../../ui/Chat'
import { Sheet } from '../../ui/Sheet'
import './chat.css'

const OPENING = "How did your interview go? Tell me like you'd tell a friend."

let nextId = 0
const line = (role, text) => ({ id: ++nextId, role, text })

export default function Recap({ companySlug, onClose }) {
  const [messages, setMessages] = useState(() => [line('raven', OPENING)])
  const [thinking, setThinking] = useState(false)
  const [listening, setListening] = useState(false)
  const [result, setResult] = useState(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState(null)
  const latest = useRef(messages)
  const call = useRef(null)
  useEffect(() => {
    latest.current = messages
  })
  useEffect(() => () => call.current?.stop(), [])
  const end = useStickToBottom(messages.length + (thinking ? 1 : 0) + (result ? 1 : 0))

  const handle = (reply) => {
    setMessages((m) => [...m, line('raven', reply.reply)])
    if (reply.done) setResult(reply)
  }

  const send = async (text) => {
    if (thinking || result || !text.trim()) return
    const history = latest.current.map((m) => ({ role: m.role, text: m.text }))
    setMessages((m) => [...m, line('user', text)])
    setDraft('')
    setError(null)
    setThinking(true)
    try {
      handle(await recapApi.turn(companySlug, text, history))
    } catch (e) {
      setError(e.message)
    } finally {
      setThinking(false)
    }
  }

  /** Every recognised line lands in the chat as it's said; when the call ends, the transcript goes to the server. */
  const startCall = async () => {
    if (call.current || result) return
    setListening(true)
    setError(null)
    let started
    try {
      started = await recapApi.startVoice(companySlug)
    } catch (e) {
      setError(e.message)
      setListening(false)
      return
    }
    const transcript = []
    let finished = false
    const finish = async () => {
      if (finished) return
      finished = true
      call.current = null
      setListening(false)
      if (!transcript.some((l) => l.speaker === 'user')) {
        setMessages((m) => [...m, line('raven', "I couldn't hear you. Type it instead?")])
        return
      }
      setThinking(true)
      try {
        handle(await recapApi.finishVoice(started.sessionId, transcript))
      } catch (e) {
        setError(e.message)
      } finally {
        setThinking(false)
      }
    }
    try {
      call.current = await startVoice(started.credentials, {
        state: () => {},
        line: (speaker, text) => {
          const who = speaker === 'agent' ? 'raven' : 'user'
          transcript.push({ speaker: who, text })
          // the spoken opening is the one already on screen
          if (who === 'raven' && transcript.length === 1 && text === OPENING) return
          setMessages((m) => [...m, line(who, text)])
        },
        ended: finish,
        failed: (msg) => {
          setError(msg)
          call.current?.stop()
        },
      })
    } catch (e) {
      call.current = null
      setListening(false)
      setError(e instanceof MicDenied ? 'The microphone is blocked. Type it instead?' : e.message)
    }
  }

  const mic = { listening, onToggle: () => (listening ? call.current?.stop() : startCall()) }

  return (
    <Sheet
      onClose={onClose}
      size="large"
      header={{ title: 'How it went' }}
      footer={(close) =>
        result ? (
          <div className="recap__done">
            <button type="button" className="glass-prominent" onClick={close}>
              Done
            </button>
          </div>
        ) : (
          <Composer
            value={draft}
            onChange={setDraft}
            onSend={() => send(draft.trim())}
            placeholder="Type it, or tap the mic"
            disabled={thinking || listening}
            mic={mic}
            error={error}
          />
        )
      }
    >
      <div className="chat">
        {messages.map((m) => (
          <Bubble key={m.id} from={m.role}>
            {m.text}
          </Bubble>
        ))}
        {thinking && <TypingIndicator />}
        {result && <SharedCard result={result} />}
        <div ref={end} />
      </div>
    </Sheet>
  )
}

/** RecapSharedCard.swift */
function SharedCard({ result }) {
  const x = result.extracted ?? {}
  const where = [x.company, x.role, x.round && `${x.round} round`].filter(Boolean).join(' · ')
  return (
    <section className="card recap-card">
      <h3 className={`t-headline row recap-card__head ${result.shared ? 'c-agent' : 'c-2'}`}>
        {result.shared ? <UsersRound size={17} strokeWidth={2.4} aria-hidden /> : <Lock size={16} strokeWidth={2.4} aria-hidden />}
        {result.shared ? 'Shared anonymously' : 'Kept in your notes'}
      </h3>
      {where && <p className="t-title3">{where}</p>}
      {x.questions?.length > 0 && (
        <ul className="recap-card__questions">
          {x.questions.map((q) => (
            <li key={q} className="t-subhead">
              <HelpCircle size={16} strokeWidth={2.2} className="c-2" aria-hidden /> {q}
            </li>
          ))}
        </ul>
      )}
      {x.tip && <p className="t-subhead c-2">Tip: {x.tip}</p>}
      <p className="t-footnote c-2">
        {result.shared
          ? 'Names and contact details were removed. Others preparing for the same interview will see the questions.'
          : 'Nothing went public. You can tell Raven more any time.'}
      </p>
    </section>
  )
}
