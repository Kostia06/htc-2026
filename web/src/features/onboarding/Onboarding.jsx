// OnboardingFlow.swift: one question per screen. A picked resume is read in the background and fills in whatever
// hasn't been answered yet, so nothing ever waits on it until Finish.
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, CircleCheck, FileSearch, FileText, FileUp, List } from 'lucide-react'
import { useApp } from '../../app/context'
import { Ambient } from '../../app/Shell'
import { onboardingApi, RESUME_ACCEPT } from '../../lib/client'
import { RaisedButton } from '../../ui/Button'
import { OptionTile } from '../../ui/Controls'
import { draftToAnswers, isAnswered, toProfile } from './answers'
import { visibleQuestions } from './questions'
import './onboarding.css'

const AUTO_ADVANCE_MS = 250

export default function Onboarding() {
  const app = useApp()
  const [answers, setAnswers] = useState({})
  const [fromResume, setFromResume] = useState([])
  const [position, setPosition] = useState(0)
  const [direction, setDirection] = useState('forward')
  const [resume, setResume] = useState({ state: 'none' })
  const [finishing, setFinishing] = useState(false)
  const [error, setError] = useState(null)
  const reading = useRef(null)
  const current = useRef(null)

  const questions = visibleQuestions(answers)
  const q = questions[Math.min(position, questions.length - 1)]
  const isLast = position >= questions.length - 1
  const value = answers[q.id]
  const answered = isAnswered(q, value)
  const canSkip = !q.required && !answered
  const progress = (position + 1) / questions.length

  useEffect(() => {
    current.current = q.id
  })

  const goForward = () => {
    if (isLast) return
    setDirection('forward')
    setPosition((p) => p + 1)
  }
  const goBack = () => {
    if (position === 0) return
    setDirection('back')
    setPosition((p) => p - 1)
  }

  const answer = (v) => {
    setAnswers((a) => ({ ...a, [q.id]: v }))
    setFromResume((ids) => ids.filter((id) => id !== q.id))
  }

  const pickSingle = (option) => {
    answer(option)
    if (isLast) return
    const asked = q.id
    // only if they're still on that question, so a delayed advance never skips one
    setTimeout(() => {
      if (current.current !== asked) return
      setDirection('forward')
      setPosition((p) => p + 1)
    }, AUTO_ADVANCE_MS)
  }

  const read = (file) => {
    if (!file) return
    setResume({ state: 'reading', fileName: file.name })
    reading.current = onboardingApi
      .uploadResume(file)
      .then((result) => {
        if (!result?.draft) throw new Error('no draft')
        setResume({ state: 'ready', draft: result.draft, documentId: result.documentId })
        const filled = draftToAnswers(result.draft)
        setAnswers((a) => {
          const next = { ...a }
          const added = []
          for (const [id, v] of Object.entries(filled)) {
            const question = visibleQuestions(next).find((x) => x.id === id) ?? { type: typeof v === 'object' && !Array.isArray(v) ? 'text' : 'single' }
            if (!isAnswered(question, next[id])) {
              next[id] = v
              added.push(id)
            }
          }
          setFromResume((ids) => [...new Set([...ids, ...added])])
          return next
        })
        return result
      })
      .catch(() => {
        setResume({ state: 'failed' })
        return null
      })
    goForward()
  }

  const finish = async () => {
    setFinishing(true)
    setError(null)
    const result = await reading.current
    try {
      const saved = await onboardingApi.confirm(result?.documentId, toProfile(answers, result?.draft))
      app.finishOnboarding(saved)
    } catch (e) {
      setError(e.message)
      setFinishing(false)
    }
  }

  const waitingForResume = finishing && resume.state === 'reading'

  return (
    <div className="ob">
      <Ambient />
      <header className="ob__header">
        <div className="ob__header-row">
          <button type="button" className="ob__back" onClick={goBack} aria-label="Back" style={{ opacity: position === 0 ? 0 : 1 }} disabled={position === 0}>
            <ChevronLeft size={24} strokeWidth={2.6} aria-hidden />
          </button>
          <div className="ob__progress" role="progressbar" aria-label="Progress" aria-valuemin={1} aria-valuemax={questions.length} aria-valuenow={position + 1}>
            <span style={{ width: `max(14px, ${progress * 100}%)` }} />
          </div>
        </div>
        {resume.state === 'reading' && (
          <p className="ob__reading t-footnote semibold c-agent shimmering">
            <FileSearch size={15} strokeWidth={2.4} aria-hidden /> Reading your resume
          </p>
        )}
        {resume.state === 'failed' && (
          <p className="ob__reading t-footnote c-negative">Couldn&rsquo;t read that file. The questions work just as well.</p>
        )}
      </header>

      <main className="ob__scroll">
        <div className={`ob__question ob__question--${direction}`} key={q.id}>
          {fromResume.includes(q.id) && (
            <span className="ob__tag t-footnote semibold">
              <FileText size={14} strokeWidth={2.4} aria-hidden /> From your resume
            </span>
          )}
          <h1 className="t-title2">{q.title}</h1>
          <p className="t-body c-2">{q.hint}</p>
          <div className="ob__answer">
            {q.type === 'resume' && <ResumeChoice onFile={read} onSkip={goForward} />}
            {q.type === 'single' && <SingleChoice question={q} value={value} onPick={pickSingle} />}
            {q.type === 'multi' && <MultiChoice question={q} value={value ?? []} onChange={answer} />}
            {q.type === 'text' && <TextFields question={q} value={value ?? {}} onChange={answer} onSubmit={isLast ? finish : goForward} />}
          </div>
          {error && (
            <p className="ob__error t-footnote" role="alert">
              <strong>Something went wrong.</strong> {error}
            </p>
          )}
        </div>
      </main>

      {q.type !== 'resume' && (
        <footer className="ob__bar">
          {canSkip && (
            <button type="button" className="ob__skip t-headline c-2" onClick={isLast ? finish : goForward}>
              Skip
            </button>
          )}
          <RaisedButton
            variant={answered ? 'action' : 'muted'}
            disabled={!answered || finishing}
            busy={finishing && !waitingForResume}
            onClick={isLast ? finish : goForward}
          >
            {isLast ? 'Finish' : 'Continue'}
          </RaisedButton>
        </footer>
      )}

      {waitingForResume && (
        <div className="ob__finishing" role="status">
          <CircleCheck size={44} strokeWidth={2} className="c-agent ob__finishing-icon" aria-hidden />
          <h2 className="t-title2 c-agent">Finishing up</h2>
          <p className="t-body c-2">Adding what&rsquo;s on your resume to your answers.</p>
        </div>
      )}
    </div>
  )
}

function ResumeChoice({ onFile, onSkip }) {
  const input = useRef(null)
  const [over, setOver] = useState(false)
  return (
    <div className="ob__options">
      <input ref={input} type="file" accept={RESUME_ACCEPT} hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <OptionTile
        onClick={() => input.current?.click()}
        className={over ? 'is-over' : ''}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          onFile(e.dataTransfer.files?.[0])
        }}
      >
        <FileUp size={22} strokeWidth={2.2} className="c-action" aria-hidden />
        <span className="stack">
          <span>Yes, upload my resume</span>
          <span className="t-footnote c-2 ob__sub">PDF, Word or a photo</span>
        </span>
      </OptionTile>
      <OptionTile onClick={onSkip}>
        <List size={22} strokeWidth={2.2} className="c-2" aria-hidden />
        No, I&rsquo;ll answer a few questions
      </OptionTile>
    </div>
  )
}

function SingleChoice({ question, value, onPick }) {
  const options = value && !question.options.includes(value) ? [...question.options, value] : question.options
  return (
    <div className="ob__options">
      {options.map((option) => (
        <OptionTile key={option} selected={option === value} onClick={() => onPick(option)}>
          {option}
        </OptionTile>
      ))}
      {question.other && <OtherField placeholder="Or type your own" onAdd={onPick} />}
    </div>
  )
}

function MultiChoice({ question, value, onChange }) {
  const full = value.length >= question.max
  const options = [...question.options, ...value.filter((v) => !question.options.includes(v))]
  const toggle = (option) => {
    if (value.includes(option)) onChange(value.filter((v) => v !== option))
    else if (!full) onChange([...value, option])
  }
  return (
    <>
      <div className="ob__flow">
        {options.map((option) => {
          const on = value.includes(option)
          return (
            <OptionTile key={option} selected={on} disabled={!on && full} onClick={() => toggle(option)}>
              {option}
            </OptionTile>
          )
        })}
      </div>
      {question.other && (
        <OtherField
          placeholder="Add your own"
          disabled={full}
          onAdd={(text) => {
            if (!value.some((v) => v.toLowerCase() === text.toLowerCase())) onChange([...value, text])
          }}
        />
      )}
    </>
  )
}

function OtherField({ placeholder, onAdd, disabled }) {
  const [text, setText] = useState('')
  const submit = (e) => {
    e.preventDefault()
    const t = text.trim()
    if (!t || disabled) return
    setText('')
    onAdd(t)
  }
  return (
    <form className="ob__other" onSubmit={submit}>
      <input className="field" value={text} maxLength={80} placeholder={placeholder} onChange={(e) => setText(e.target.value)} aria-label={placeholder} disabled={disabled} />
      {text.trim() && (
        <button type="submit" className="t-headline c-action ob__add">
          Add
        </button>
      )}
    </form>
  )
}

function TextFields({ question, value, onChange, onSubmit }) {
  return (
    <form
      className="ob__fields"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      {question.fields.map((f) => (
        <label key={f.id} className="field-label">
          <span className="t-subhead semibold c-2">{f.label}</span>
          <input
            className="field"
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
