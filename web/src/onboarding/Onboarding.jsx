import { useEffect, useRef, useState } from 'react'
import { visibleQuestions } from '../features/onboarding/questions'
import { draftToAnswers, RESUME_ACCEPT, saveAnswers, syncProfile, uploadResume } from './store'
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

// what the AI drafted, shown before any question: the same check the iOS app gives before saving
function ResumeReview({ resume }) {
  const { summary, missing = [], droppedClaims = 0, draft = {} } = resume
  const skills = draft.skills ?? []
  const work = [...(draft.experience ?? []).map((e) => [e.role, e.org]), ...(draft.education ?? []).map((e) => [e.program || 'Studies', e.school])]
  return (
    <section className="ob__review" aria-label="What Raven read from your resume">
      {summary && <p className="ob__review-summary">{summary}</p>}
      {skills.length > 0 && (
        <div>
          <h2 className="ob__review-h">Skills Raven found</h2>
          <ul className="ob__review-skills">
            {skills.map((s) => (
              <li key={s.name}>
                <strong>{s.name}</strong>
                {s.evidence && <span>“{s.evidence}”</span>}
              </li>
            ))}
          </ul>
          {droppedClaims > 0 && (
            <p className="ob__review-note">Raven left out {droppedClaims} skill{droppedClaims === 1 ? '' : 's'} it couldn't point to in your resume.</p>
          )}
        </div>
      )}
      {work.length > 0 && (
        <div>
          <h2 className="ob__review-h">Experience and education</h2>
          <ul className="ob__review-list">
            {work.map(([a, b], i) => <li key={i}>{a}{b ? <span> · {b}</span> : null}</li>)}
          </ul>
        </div>
      )}
      {missing.length > 0 && (
        <div>
          <h2 className="ob__review-h">Still worth adding</h2>
          <ul className="ob__review-list ob__review-list--muted">
            {missing.map((m) => <li key={m}>{m}</li>)}
          </ul>
        </div>
      )}
      <p className="ob__review-note">You can change anything in the next questions. The file itself is never kept.</p>
    </section>
  )
}

function ResumeStep({ value, onUploaded, onSkip }) {
  const input = useRef(null)
  const [state, setState] = useState(value?.fileName ? 'done' : 'idle') // idle | reading | done | error
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)

  async function read(file) {
    if (!file) return
    setState('reading')
    setError('')
    try {
      const result = await uploadResume(file)
      setState('done')
      onUploaded({ ...result, fileName: file.name })
    } catch (e) {
      setState('error')
      setError(e.message)
    }
  }

  if (state === 'reading') {
    return (
      <div className="ob__resume ob__resume--busy" role="status">
        <span className="ob__spinner" aria-hidden="true" />
        <p>Reading your resume… this takes a few seconds.</p>
      </div>
    )
  }

  return (
    <div className="ob__resume">
      <input ref={input} type="file" accept={RESUME_ACCEPT} hidden onChange={(e) => read(e.target.files?.[0])} />
      <button
        type="button"
        className={`ob__drop${dragging ? ' is-over' : ''}`}
        onClick={() => input.current?.click()}
        onDragOver={(e) => (e.preventDefault(), setDragging(true))}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => (e.preventDefault(), setDragging(false), read(e.dataTransfer.files?.[0]))}
      >
        <strong>{state === 'done' ? `Uploaded ${value.fileName}` : 'Yes, upload my resume'}</strong>
        <span>{state === 'done' ? 'Upload a different file' : 'PDF, Word or a photo · drop it here or click'}</span>
      </button>
      {state === 'error' && (
        <p className="ob__error" role="alert">Couldn't use that file: {error}. Try another, or answer the questions instead.</p>
      )}
      {state === 'done' && <ResumeReview resume={value} />}
      {state === 'done' ? (
        <button type="button" className="ob__next ob__no-resume" onClick={onSkip}>Looks right, continue</button>
      ) : (
        <button type="button" className="ob__chip ob__no-resume" onClick={onSkip}>No, I'll answer a few questions</button>
      )}
    </div>
  )
}

export default function Onboarding({ session, onDone }) {
  const name = session.user.user_metadata?.full_name?.split(' ')[0]
  const [answers, setAnswers] = useState({})
  const [prefilled, setPrefilled] = useState([])
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const heading = useRef(null)

  const questions = visibleQuestions(answers)
  const q = questions[Math.min(step, questions.length - 1)]
  const last = step >= questions.length - 1
  const value = answers[q.id]
  const answered = Array.isArray(value) ? value.length > 0 : q.type === 'text' ? true : Boolean(value)
  const fromResume = prefilled.includes(q.id)

  // move focus to the new question so keyboard and screen-reader users follow along
  useEffect(() => heading.current?.focus(), [step])

  const set = (v) => setAnswers((a) => ({ ...a, [q.id]: v }))

  const onUploaded = (result) => {
    const filled = draftToAnswers(result.draft)
    setPrefilled(Object.keys(filled))
    const { documentId, draft, fileName, summary, missing, droppedClaims } = result
    setAnswers((a) => ({ ...a, ...filled, resume: { documentId, draft, fileName, summary, missing, droppedClaims } }))
  }

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
          {fromResume && <p className="ob__from-resume">Filled in from your resume. Change anything that's off.</p>}
          {q.type === 'resume' ? (
            <ResumeStep value={value} onUploaded={onUploaded} onSkip={() => setStep(1)} />
          ) : q.type === 'text' ? (
            <TextFields question={q} value={value} onChange={set} onSubmit={() => next()} />
          ) : (
            <Chips question={q} value={value} onChange={pick} />
          )}
        </div>

        <div className="ob__nav" hidden={q.type === 'resume'}>
          <button type="button" className="ob__back" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>Back</button>
          <div className="ob__nav-right">
            {!answered || q.type === 'text' ? (
              <button type="button" className="ob__skip" onClick={() => next()}>Skip</button>
            ) : null}
            {(q.type !== 'single' || last || answered) && (
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
