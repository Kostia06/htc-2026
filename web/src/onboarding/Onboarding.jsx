import { useEffect, useRef, useState } from 'react'
import { visibleQuestions } from './questions'
import { saveAnswers, syncProfile } from './store'
import './onboarding.css'

function Chips({ question, value, onChange }) {
  const [custom, setCustom] = useState('')
  const multi = question.type === 'multi'
  const selected = multi ? value ?? [] : value ? [value] : []
  const options = [...question.options, ...selected.filter((s) => !question.options.includes(s))]
  const full = multi && selected.length >= question.max

  const toggle = (option) => {
    if (!multi) return onChange(option)
    if (selected.includes(option)) onChange(selected.filter((s) => s !== option))
    else if (!full) onChange([...selected, option])
  }

  const addCustom = (e) => {
    e.preventDefault()
    const text = custom.trim()
    if (!text) return
    setCustom('')
    if (!multi) return onChange(text)
    if (!selected.includes(text) && !full) onChange([...selected, text])
  }

  return (
    <>
      <div className="ob__chips">
        {options.map((option) => {
          const on = selected.includes(option)
          return (
            <button
              key={option}
              type="button"
              className={`ob__chip${on ? ' is-on' : ''}`}
              aria-pressed={on}
              disabled={!on && full}
              onClick={() => toggle(option)}
            >
              {option}
            </button>
          )
        })}
      </div>
      {question.other && (
        <form className="ob__other" onSubmit={addCustom}>
          <label className="ob__sr" htmlFor={`other-${question.id}`}>Something else</label>
          <input
            id={`other-${question.id}`}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder={multi ? 'Add your own…' : 'Or type your own…'}
            maxLength={80}
          />
          <button type="submit" disabled={!custom.trim() || full}>Add</button>
        </form>
      )}
    </>
  )
}

function TextFields({ question, value = {}, onChange, onSubmit }) {
  return (
    <form className="ob__fields" onSubmit={(e) => (e.preventDefault(), onSubmit())}>
      {question.fields.map((f) => (
        <label key={f.id} className="ob__field">
          <span>{f.label}</span>
          <input
            value={value[f.id] ?? ''}
            placeholder={f.placeholder}
            autoComplete={f.autoComplete ?? 'off'}
            maxLength={120}
            onChange={(e) => onChange({ ...value, [f.id]: e.target.value })}
          />
        </label>
      ))}
      <button type="submit" hidden />
    </form>
  )
}

export default function Onboarding({ session, onDone }) {
  const name = session.user.user_metadata?.full_name?.split(' ')[0]
  const [answers, setAnswers] = useState({})
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const heading = useRef(null)

  const questions = visibleQuestions(answers)
  const q = questions[Math.min(step, questions.length - 1)]
  const last = step >= questions.length - 1
  const value = answers[q.id]
  const answered = Array.isArray(value) ? value.length > 0 : q.type === 'text' ? true : Boolean(value)

  // move focus to the new question so keyboard and screen-reader users follow along
  useEffect(() => heading.current?.focus(), [step])

  const set = (v) => setAnswers((a) => ({ ...a, [q.id]: v }))

  async function finish(final) {
    setSaving(true)
    saveAnswers(session.user.id, final)
    const problem = await syncProfile(final)
    onDone(final, problem)
  }

  const next = (final = answers) => (last ? finish(final) : setStep((s) => s + 1))

  // single choice: tapping an option is the answer, so move on by itself (the last one waits for Finish)
  const pick = (v) => {
    const final = { ...answers, [q.id]: v }
    setAnswers(final)
    if (q.type === 'single' && !last) setTimeout(() => next(final), 220)
  }

  if (saving) {
    return (
      <main className="ob">
        <div className="ob__card ob__card--center" role="status">
          <span className="ob__spinner" aria-hidden="true" />
          <p>Building your profile…</p>
        </div>
      </main>
    )
  }

  return (
    <main className="ob">
      <div className="ob__card">
        <div className="ob__top">
          <span>{step === 0 && name ? `Hi ${name}. ` : ''}Question {step + 1} of {questions.length}</span>
          <div className="ob__bar" role="progressbar" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={step + 1} aria-label="Progress">
            <i style={{ width: `${((step + 1) / questions.length) * 100}%` }} />
          </div>
        </div>

        <div className="ob__q" key={q.id}>
          <h1 className="ob__title" tabIndex={-1} ref={heading}>{q.title}</h1>
          <p className="ob__hint">{q.hint}</p>
          {q.type === 'text' ? (
            <TextFields question={q} value={value} onChange={set} onSubmit={() => next()} />
          ) : (
            <Chips question={q} value={value} onChange={pick} />
          )}
        </div>

        <div className="ob__nav">
          <button type="button" className="ob__back" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>Back</button>
          <div className="ob__nav-right">
            {!answered || q.type === 'text' ? (
              <button type="button" className="ob__skip" onClick={() => next()}>Skip</button>
            ) : null}
            {(q.type !== 'single' || last) && (
              <button type="button" className="ob__next" onClick={() => next()} disabled={!answered && q.type !== 'text'}>
                {last ? 'Finish' : 'Continue'}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
