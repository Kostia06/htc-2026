import { useState } from 'react'
import { toSlug, voice } from '../lib/agent'
import { useSkill } from './useSkill'
import { Problem, Steps, Thinking, Updated } from './ui'

const SOURCES = { reported: 'Asked recently', resume: 'From your resume', behavioral: 'Common question' }

function CompanyRole({ company, setCompany, role, setRole, companyRequired, idPrefix }) {
  return (
    <div className="db__pair">
      <label className="ob__field">
        <span>Company{companyRequired ? '' : ' (optional)'}</span>
        <input id={`${idPrefix}-company`} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. ATB Financial" maxLength={100} />
      </label>
      <label className="ob__field">
        <span>Role</span>
        <input id={`${idPrefix}-role`} value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Junior data analyst" maxLength={100} />
      </label>
    </div>
  )
}

const unknownCompany = (error, company) =>
  error?.status === 404 ? { message: `Raven doesn't have interview notes for "${company}" yet. Check the spelling, or leave it blank for general questions` } : error

/** interview-prep: five questions for one company, weighted toward this person's weak spots. */
export function InterviewPrep({ userId, stamp, defaultRole, onPractice }) {
  const [state, run] = useSkill({ userId, stamp, key: 'interview-prep', skill: 'interview-prep' })
  const [company, setCompany] = useState(() => (state.input?.company ?? '').replace(/-/g, ' '))
  const [role, setRole] = useState(state.input?.role ?? defaultRole ?? '')
  const busy = state.status === 'loading'
  const output = state.output

  const prepare = (e) => {
    e?.preventDefault()
    if (!toSlug(company)) return
    run({ company: toSlug(company), ...(role.trim() ? { role: role.trim() } : {}) })
  }

  return (
    <div className="db__panel">
      <p className="db__intro">Raven picks five questions for a company, starting with ones real candidates were asked there, then fills in with your weak spots.</p>
      <form className="db__form" onSubmit={prepare}>
        <CompanyRole company={company} setCompany={setCompany} role={role} setRole={setRole} companyRequired idPrefix="prep" />
        <button type="submit" className="ob__next" disabled={busy || !toSlug(company)}>{busy ? 'Preparing…' : 'Prepare me'}</button>
      </form>

      {busy && <Thinking>Raven is reading what candidates report and what it knows about you…</Thinking>}
      <Problem error={state.status === 'error' && unknownCompany(state.error, company)} onRetry={state.error?.status === 404 ? null : prepare} />

      {output && !busy && (
        <>
          {output.focus?.length > 0 && (
            <div className="db__chips">
              <span className="db__muted">Work on:</span>
              {output.focus.map((f) => <span key={f} className="db__chip">{f}</span>)}
            </div>
          )}
          <ol className="db__questions">
            {output.questions?.map((q, i) => (
              <li key={i}>
                <p>{q.text}</p>
                {q.reported && <span className="db__tag">Reported by real candidates</span>}
                {q.why && <span className="db__muted">{q.why}</span>}
              </li>
            ))}
          </ol>
          <div className="db__row">
            <button type="button" className="ob__next" onClick={() => onPractice({ company, role })}>Practise an interview</button>
            <Updated at={state.at} onRefresh={prepare} busy={busy} />
          </div>
        </>
      )}
    </div>
  )
}

function Scores({ result }) {
  const entries = Object.entries(result.scores ?? {})
  return (
    <div className="db__feedback" aria-live="polite">
      {entries.length > 0 && (
        <dl className="db__scores">
          {entries.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd><meter min={1} max={5} low={2.5} high={3.9} optimum={5} value={v} /> {v}/5</dd>
            </div>
          ))}
        </dl>
      )}
      {result.tip && <p><strong>Tip:</strong> {result.tip}</p>}
      {result.delivery?.fillerWords > 0 && <p className="db__muted">Filler words: {result.delivery.fillerWords}</p>}
    </div>
  )
}

/**
 * A typed mock interview on the same server session the iOS voice practice uses: the server plans the questions
 * from the profile and company, scores each answer, and the interview agent writes a debrief and remembers weak spots.
 */
export function Practice({ defaultRole, preset }) {
  const [company, setCompany] = useState(preset?.company ?? '')
  const [role, setRole] = useState(preset?.role || defaultRole || '')
  const [session, setSession] = useState(null) // { sessionId, opening, questions }
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [results, setResults] = useState([]) // per question: score response
  const [debrief, setDebrief] = useState(null)
  const [busy, setBusy] = useState(null) // 'start' | 'turn' | 'finish'
  const [error, setError] = useState(null)

  const act = async (kind, work) => {
    setBusy(kind)
    setError(null)
    try {
      await work()
    } catch (e) {
      setError(kind === 'start' ? unknownCompany(e, company) : e)
    } finally {
      setBusy(null)
    }
  }

  const start = (e) => {
    e?.preventDefault()
    act('start', async () => {
      const body = { mode: 'interview', ...(toSlug(company) ? { companySlug: toSlug(company) } : {}), ...(role.trim() ? { role: role.trim() } : {}) }
      const started = await voice.start(body)
      if (!started.questions?.length) throw new Error('the server planned no questions')
      setSession(started)
      setIndex(0)
      setResults([])
      setDebrief(null)
      setAnswer('')
    })
  }

  const question = session?.questions?.[index]
  const answered = results[index]
  const last = session && index >= session.questions.length - 1

  const submit = (e) => {
    e.preventDefault()
    if (!answer.trim()) return
    // typed, not spoken, so there's no speaking pace to measure: durationMs 0 leaves words per minute out
    act('turn', async () => {
      const score = await voice.turn(session.sessionId, { question: question.text, answer: answer.trim().slice(0, 4000), durationMs: 0 })
      setResults((r) => Object.assign([...r], { [index]: score }))
    })
  }

  const next = () => {
    setIndex((i) => i + 1)
    setAnswer('')
  }

  const finish = () => act('finish', async () => setDebrief(await voice.finish(session.sessionId)))

  const reset = () => {
    setSession(null)
    setDebrief(null)
    setResults([])
    setError(null)
  }

  if (debrief) {
    return (
      <div className="db__panel">
        <h3 className="db__h3">How it went</h3>
        <p className="db__lead">{debrief.summary}</p>
        <h3 className="db__h3">Before the real one</h3>
        <Steps items={debrief.prepList} />
        {debrief.savedToMemory > 0 && (
          <p className="db__muted">Raven noted {debrief.savedToMemory} pattern{debrief.savedToMemory === 1 ? '' : 's'} to work on next time. See them under "What Raven knows".</p>
        )}
        <button type="button" className="ob__next db__start" onClick={reset}>Practise again</button>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="db__panel">
        <p className="db__intro">A mock interview you answer by typing. Raven asks questions planned from your profile (and the company, if you name one), scores each answer and debriefs you at the end. For a spoken interview, use the iOS app or the Quest headset.</p>
        <form className="db__form" onSubmit={start}>
          <CompanyRole company={company} setCompany={setCompany} role={role} setRole={setRole} idPrefix="practice" />
          <button type="submit" className="ob__next" disabled={busy === 'start'}>{busy === 'start' ? 'Planning questions…' : 'Start the interview'}</button>
        </form>
        <Problem error={error} />
      </div>
    )
  }

  return (
    <div className="db__panel">
      <div className="ob__top">
        <span>Question {index + 1} of {session.questions.length}</span>
        <div className="ob__bar" role="progressbar" aria-valuemin={0} aria-valuemax={session.questions.length} aria-valuenow={index + 1} aria-label="Interview progress">
          <i style={{ width: `${((index + 1) / session.questions.length) * 100}%` }} />
        </div>
      </div>
      {index === 0 && session.opening && <p className="db__muted">{session.opening}</p>}
      <div className="db__asked">
        <p>{question.text}</p>
        {SOURCES[question.source] && <span className="db__tag">{SOURCES[question.source]}</span>}
      </div>

      <form className="db__form" onSubmit={submit}>
        <label className="ob__sr" htmlFor="practice-answer">Your answer</label>
        <textarea
          id="practice-answer"
          className="db__answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Answer as you would out loud. Try: the situation, what you did, how it turned out."
          rows={7}
          maxLength={4000}
          readOnly={Boolean(answered)}
        />
        {!answered && (
          <button type="submit" className="ob__next" disabled={busy === 'turn' || !answer.trim()}>{busy === 'turn' ? 'Scoring…' : 'Submit answer'}</button>
        )}
      </form>

      {answered && <Scores result={answered} />}
      <Problem error={error} />

      <div className="db__row">
        {answered && !last && <button type="button" className="ob__next" onClick={next}>Next question</button>}
        {results.some(Boolean) && (
          <button type="button" className={answered && last ? 'ob__next' : 'db__ghost'} onClick={finish} disabled={busy === 'finish'}>
            {busy === 'finish' ? 'Writing your debrief…' : last && answered ? 'Finish and debrief' : 'End early and debrief'}
          </button>
        )}
      </div>
      {busy === 'finish' && <Thinking>Raven is looking for patterns across your answers…</Thinking>}
    </div>
  )
}
