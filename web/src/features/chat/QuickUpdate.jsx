// QuickUpdateView.swift: "What's new?" in plain words, typed or spoken. Skillit applies it at once, or asks one
// question first. With a `focusTitle` it is about one roadmap step ("Mark done"). A pasted job link or ad is
// imported as a posting instead.
import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../app/context'
import { postingsApi, sendUpdate } from '../../lib/client'
import { announceUpdatesApplied, useStickToBottom } from '../../lib/hooks'
import { AppliedCard, Bubble, Composer, TypingIndicator } from '../../ui/Chat'
import { Sheet } from '../../ui/Sheet'
import { detectPosting, postingChanges, postingReply } from './posting'
import { useDictation } from './useDictation'
import './chat.css'

const OPENING = "What's new? One line is enough, I'll update your road and profile."
const PROFILE_CHANGES = ['add_project', 'add_experience', 'add_skill', 'remove_skill', 'add_target_role']

let nextId = 0
const line = (role, text) => ({ id: ++nextId, role, text })

export default function QuickUpdate({ focusTitle, focusStepId, onApplied, onClose }) {
  const app = useApp()
  const [messages, setMessages] = useState(() => [
    line('raven', focusTitle ? `What did you do for “${focusTitle}”? Type it or tap the mic.` : OPENING),
  ])
  const [applied, setApplied] = useState({})
  const [thinking, setThinking] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState(null)
  // where the current update began; the step question goes along with the first answer so Skillit knows the step
  const turnStart = useRef(focusTitle ? 0 : 1)
  const latest = useRef(messages)
  useEffect(() => {
    latest.current = messages
  })
  const end = useStickToBottom(messages.length + (thinking ? 1 : 0))

  const send = async (text) => {
    if (thinking || !text.trim()) return
    const conversation = latest.current.slice(turnStart.current).map((m) => ({ speaker: m.role === 'user' ? 'user' : 'raven', text: m.text }))
    setMessages((m) => [...m, line('user', text)])
    setDraft('')
    setError(null)
    setThinking(true)
    try {
      const posting = detectPosting(text)
      // a posting is its own receipt: the line says what was read, the applied card what was set up from it
      const reply = posting
        ? await postingsApi.import(posting).then((p) => ({ reply: postingReply(p), needsAnswer: false, applied: postingChanges(p) }))
        : await sendUpdate(text, conversation, focusStepId)
      const said = line('raven', reply.reply)
      setMessages((m) => {
        const next = [...m, said]
        if (!reply.needsAnswer) turnStart.current = next.length
        return next
      })
      if (!reply.needsAnswer && reply.applied?.length) {
        setApplied((a) => ({ ...a, [said.id]: reply.applied }))
        onApplied?.(reply.applied)
        if (reply.applied.some((c) => PROFILE_CHANGES.includes(c.type))) app.refreshProfile().catch(() => {})
        announceUpdatesApplied(reply.applied)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setThinking(false)
    }
  }

  const mic = useDictation({ onHeard: setDraft, onFinished: send, onError: setError })

  return (
    <Sheet
      onClose={onClose}
      size="large"
      header={{ title: focusTitle ? 'Mark done' : 'Update' }}
      footer={
        <Composer
          value={draft}
          onChange={setDraft}
          onSend={() => send(draft.trim())}
          placeholder="What's new? Or paste a job link"
          disabled={thinking || Boolean(mic?.listening)}
          mic={mic}
          error={error}
        />
      }
    >
      <div className="chat">
        {messages.map((m) => (
          <div key={m.id} className="chat__item">
            <Bubble from={m.role}>{m.text}</Bubble>
            {applied[m.id] && <AppliedCard changes={applied[m.id]} />}
          </div>
        ))}
        {thinking && <TypingIndicator />}
        <div ref={end} />
      </div>
    </Sheet>
  )
}
