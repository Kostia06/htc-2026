// SessionSummaryView.swift + DebriefRows.swift: one score that counts up, what went well, what to work on next,
// and every answer underneath. While the coach is still writing it, a calm skeleton.
import { useEffect, useRef, useState } from 'react'
import { AudioWaveform, Check, ChevronDown } from 'lucide-react'
import { RaisedButton, TextButton } from '../../ui/Button'
import { SkeletonLines } from '../../ui/Feedback'

export default function SessionSummary({ debrief, onAgain, onDone }) {
  return (
    <div className="summary">
      <div className="summary__scroll">
        {debrief ? <Ready debrief={debrief} /> : <Writing />}
      </div>
      <div className="summary__bottom">
        <RaisedButton onClick={onAgain} disabled={!debrief}>
          Practice again
        </RaisedButton>
        <TextButton onClick={onDone} disabled={!debrief} className="summary__done t-headline">
          Done
        </TextButton>
      </div>
    </div>
  )
}

function Writing() {
  return (
    <div className="summary__stack" role="status">
      <span className="summary__score-skeleton shimmering" />
      <p className="t-footnote medium c-agent row summary__reviewing">
        <AudioWaveform size={15} strokeWidth={2.4} aria-hidden /> Reviewing what you said…
      </p>
      <SkeletonLines widths={[0.9, 0.6]} highlighted={-1} />
      <SkeletonLines widths={[0.8, 0.5, 0.7]} highlighted={-1} />
    </div>
  )
}

function Ready({ debrief }) {
  const [open, setOpen] = useState(false)
  const strengths = debrief.strengths?.slice(0, 2) ?? []
  const improvements = debrief.improvements?.slice(0, 3) ?? []
  return (
    <div className="summary__stack">
      <ScoreHeadline score={debrief.overall} verdict={debrief.verdict} />

      {strengths.length > 0 && (
        <section className="summary__section">
          <h2 className="t-headline c-2">What went well</h2>
          {strengths.map((s, i) => (
            <div key={i} className="summary__row">
              <Check size={17} strokeWidth={3} className="c-action" aria-hidden />
              <p className="t-body">{s.why}</p>
            </div>
          ))}
        </section>
      )}

      {improvements.length > 0 && (
        <section className="summary__section">
          <h2 className="t-headline c-2">Work on next</h2>
          {improvements.map((item, i) => (
            <Improvement key={i} number={i + 1} item={item} />
          ))}
        </section>
      )}

      {debrief.perQuestion?.length > 0 && (
        <section className="summary__answers">
          <button type="button" className="summary__disclosure t-subhead medium c-2" aria-expanded={open} onClick={() => setOpen(!open)}>
            See every answer
            <ChevronDown size={16} strokeWidth={2.4} style={{ transform: open ? 'rotate(180deg)' : 'none' }} aria-hidden />
          </button>
          {open && (
            <div className="summary__questions">
              {debrief.perQuestion.map((q, i) => (
                <div key={i} className="summary__question">
                  <span className={`t-title3 bold mono summary__q-score${q.score < 55 ? ' c-action' : ''}`}>{q.score}</span>
                  <div className="stack grow">
                    <p className="t-subhead medium">{q.question}</p>
                    <p className="t-footnote c-2">{q.oneLineFeedback}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

/** The score counts up from zero when it appears. */
function ScoreHeadline({ score, verdict }) {
  const [shown, setShown] = useState(0)
  const startedAt = useRef(null)
  useEffect(() => {
    let frame
    const tick = (now) => {
      startedAt.current ??= now
      const t = Math.min(1, (now - startedAt.current) / 1100)
      // a spring that settles with a little overshoot, like .spring(1.1, bounce 0.15)
      const eased = 1 - Math.pow(1 - t, 3) * Math.cos(t * Math.PI * 0.5)
      setShown(Math.round(score * Math.min(1, eased)))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [score])
  return (
    <div className="score-headline">
      <p className="row score-headline__num">
        <span className="rounded-num bold">{shown}</span>
        <span className="t-title3 medium c-2">/100</span>
      </p>
      <p className="t-title3 medium">{verdict}</p>
    </div>
  )
}

function Improvement({ number, item }) {
  const [showExample, setShowExample] = useState(false)
  const short = item.example && item.example.length <= 90
  return (
    <div className="summary__row">
      <span className="t-subhead bold mono c-action summary__num">{number}</span>
      <div className="stack summary__improve">
        <p className="t-body">{item.better}</p>
        {item.example &&
          (short || showExample ? (
            <p className="t-subhead c-2 summary__example">Try: &ldquo;{item.example}&rdquo;</p>
          ) : (
            <button type="button" className="t-subhead semibold c-action summary__show" onClick={() => setShowExample(true)}>
              Show an example
            </button>
          ))}
      </div>
    </div>
  )
}
