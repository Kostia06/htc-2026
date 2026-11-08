// The chat pieces QuickUpdateView and RecapView share: bubbles, the typing dots, the "Applied" card and the composer.
import { useEffect, useRef } from 'react'
import { ArrowUp, CircleCheck, Mic, Square } from 'lucide-react'

/** Raven on the left in a raised bubble; the person on the right in sage. */
export function Bubble({ from, children }) {
  return (
    <div className={`bubble-row bubble-row--${from}`}>
      <p className={`bubble bubble--${from} t-body`}>{children}</p>
    </div>
  )
}

export function TypingIndicator() {
  return (
    <div className="bubble-row bubble-row--raven">
      <div className="bubble bubble--raven typing" role="status" aria-label="Raven is typing">
        <span />
        <span />
        <span />
      </div>
    </div>
  )
}

export function AppliedCard({ changes }) {
  return (
    <div className="applied">
      <p className="t-subhead semibold c-agent row applied__title">
        <CircleCheck size={16} strokeWidth={2.4} aria-hidden /> Applied
      </p>
      {changes.map((c) => (
        <p key={`${c.type}:${c.summary}`} className="t-subhead c-2">
          {c.summary}
        </p>
      ))}
    </div>
  )
}

/**
 * The bottom bar: an optional mic (sand), a growing text field and the send button (sage).
 * `mic` is { listening, onToggle } or null when the browser has no dictation.
 */
export function Composer({ value, onChange, onSend, placeholder, disabled, mic, error }) {
  const field = useRef(null)
  useEffect(() => {
    const el = field.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 4 * 22 + 26)}px`
  }, [value])
  const canSend = value.trim().length > 0 && !disabled
  return (
    <div className="composer glass-strong">
      {error && <p className="t-footnote c-negative composer__error">{error}</p>}
      <form
        className="composer__row"
        onSubmit={(e) => {
          e.preventDefault()
          if (canSend) onSend()
        }}
      >
        {mic && (
          <button
            type="button"
            className={`glass-prominent agent composer__mic${mic.listening ? ' is-listening' : ''}`}
            onClick={mic.onToggle}
            disabled={disabled && !mic.listening}
            aria-label={mic.listening ? 'Stop and send' : 'Speak'}
          >
            {mic.listening ? <Square size={18} fill="currentColor" aria-hidden /> : <Mic size={22} strokeWidth={2.4} aria-hidden />}
          </button>
        )}
        <textarea
          ref={field}
          rows={1}
          className="composer__field"
          value={value}
          placeholder={mic?.listening ? 'Listening…' : placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (canSend) onSend()
            }
          }}
          aria-label={placeholder}
        />
        <button type="submit" className="glass-prominent composer__send" disabled={!canSend} aria-label="Send">
          <ArrowUp size={20} strokeWidth={2.8} aria-hidden />
        </button>
      </form>
    </div>
  )
}
