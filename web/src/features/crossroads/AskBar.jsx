// Ask Crossroads: the chat composer pinned under the page. Answers come only from what the page shows, and what they
// cite lights up on the page; the server allows one clarifying question per conversation.
import { useEffect, useRef, useState } from 'react'
import { crossroadsApi } from '../../lib/client'
import { useStickToBottom } from '../../lib/hooks'
import { Bubble, Composer, TypingIndicator } from '../../ui/Chat'
import { useDictation } from '../chat/useDictation'
import '../chat/chat.css'

// three to tap, so nobody faces a blank field
const SUGGESTIONS = ['What should I do next?', 'Is my struggle common?', 'What do interviews ask?']

let nextId = 0
const line = (role, text) => ({ id: ++nextId, role, text })

export function AskBar({ onCited }) {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState(null)
  const latest = useRef(messages)
  useEffect(() => {
    latest.current = messages
  })
  const end = useStickToBottom(messages.length + (thinking ? 1 : 0))

  const send = async (text) => {
    if (thinking || !text.trim()) return
    const conversation = latest.current.map((m) => ({ speaker: m.role === 'user' ? 'user' : 'raven', text: m.text }))
    setMessages((m) => [...m, line('user', text)])
    setDraft('')
    setError(null)
    setThinking(true)
    try {
      const answer = await crossroadsApi.ask(text, conversation)
      setMessages((m) => [...m, line('raven', answer.reply)])
      onCited(answer.cites ?? [])
    } catch (e) {
      setError(e.message)
    } finally {
      setThinking(false)
    }
  }

  const mic = useDictation({ onHeard: setDraft, onFinished: send, onError: setError })

  return (
    <div className="xr-ask">
      {messages.length > 0 && (
        <div className="xr-ask__log chat" aria-live="polite">
          {messages.map((m) => (
            <Bubble key={m.id} from={m.role}>
              {m.text}
            </Bubble>
          ))}
          {thinking && <TypingIndicator />}
          <div ref={end} />
        </div>
      )}
      {messages.length === 0 && !draft && (
        <div className="xr-suggest" role="group" aria-label="Suggested questions">
          {SUGGESTIONS.map((q) => (
            <button key={q} type="button" className="xr-suggest__chip glass-strong" onClick={() => send(q)} disabled={thinking}>
              {q}
            </button>
          ))}
        </div>
      )}
      <Composer
        value={draft}
        onChange={setDraft}
        onSend={() => send(draft.trim())}
        placeholder="Ask about your road"
        disabled={thinking || Boolean(mic?.listening)}
        mic={mic}
        error={error}
      />
    </div>
  )
}
