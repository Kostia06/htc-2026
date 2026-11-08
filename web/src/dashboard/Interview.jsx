import { useState } from 'react'
import { toSlug, voice } from '../lib/agent'
import { useSkill } from './useSkill'
import { PageHead, Problem, Steps, Thinking, Updated } from './ui'
import './interview.css'

const SOURCES = { reported: 'Asked recently', resume: 'From your resume', technical: 'Technical', behavioral: 'Common question' }

function CompanyRole({ company, setCompany, role, setRole, companyRequired, idPrefix }) {
  return (
    <>
      <label className="ob__field">
        <span>Role</span>
        <input id={`${idPrefix}-role`} value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Junior data analyst" maxLength={100} />
      </label>
      <label className="ob__field">
        <span>Company{companyRequired ? '' : <em className="iv__opt"> (optional)</em>}</span>
        <input id={`${idPrefix}-company`} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. ATB Financial" maxLength={100} />
      </label>
    </>
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
    <div className="pg__grid">
      <form className="pg__side pg__card iv__setup" onSubmit={prepare}>
        <h2>Set up</h2>
        <CompanyRole company={company} setCompany={setCompany} role={role} setRole={setRole} companyRequired idPrefix="prep" />
        <button type="submit" className="ob__next" disabled={busy || !toSlug(company)}>{busy ? 'Preparing…' : output ? 'Prepare again' : 'Prepare me'}</button>
        <p className="pg__label">Five questions for one company, starting with ones real candidates were asked there.</p>
      </form>

      <section className="pg__main" aria-label="Questions to prepare">
        {busy && <Thinking>Raven is reading what candidates report and what it knows about you…</Thinking>}
        <Problem error={state.status === 'error' && unknownCompany(state.error, company)} onRetry={state.error?.status === 404 ? null : prepare} />

        {!output && !busy && (
          <div className="pg__card pg__card--dashed">
            <h2>Name a company to start</h2>
            <p className="pg__muted">Raven picks five questions, starting with ones real candidates were asked there, then fills in with your weak spots.</p>
          </div>
        )}

        {output && !busy && (
          <div className="pg__card iv__prep">
            <h2>Five questions to prepare</h2>
            {output.focus?.length > 0 && (
              <div className="db__chips">
                <span className="pg__label">Work on</span>
                {output.focus.map((f) => <span key={f} className="db__chip">{f}</span>)}
              </div>
            )}
            <ol className="iv__questions">
              {output.questions?.map((q, i) => (
                <li key={i}>
                  <span className="iv__n">{String(i + 1).padStart(2, '0')}</span>
                  <span className="iv__q">
                    <span>{q.text}</span>
                    {q.why && <span className="iv__why">{q.why}</span>}
                  </span>
                  {q.reported && <span className="pg__pill">Asked of real candidates</span>}
                </li>
              ))}
            </ol>
            <div className="db__row">
              <button type="button" className="ob__next" onClick={() => onPractice({ company, role })}>Practise these out loud</button>
              <Updated at={state.at} onRefresh={prepare} busy={busy} />
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function Scores({ result, n }) {
  const entries = Object.entries(result.scores ?? {})
  return (
    <div className="pg__card pg__card--dashed iv__scores" aria-live="polite">
      <span className="pg__label">Question {n} · how it scored</span>
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
      {result.tip && (
        <div className="iv__tip">
          <span className="pg__label">Tighten</span>
          <p>{result.tip}</p>
        </div>
      )}
      {result.delivery?.fillerWords > 0 && <p className="pg__label">Filler words: {result.delivery.fillerWords}</p>}
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

  const total = session?.questions?.length ?? 0

  return (
    <div className="pg__grid">
      <form className="pg__side pg__card iv__setup" onSubmit={start}>
        <h2>Set up</h2>
        <CompanyRole company={company} setCompany={setCompany} role={role} setRole={setRole} idPrefix="practice" />
        <button type="submit" className={session ? 'db__ghost' : 'ob__next'} disabled={!!busy}>
          {busy === 'start' ? 'Planning questions…' : session ? 'Restart interview' : 'Start the interview'}
        </button>
        <p className="pg__label">Typed answers, scored one by one. For a spoken interview, use the iOS app or the Quest headset.</p>
      </form>

      <section className="pg__main" aria-label="Mock interview">
        {!session && !debrief && (
          <div className="pg__card pg__card--dashed">
            <h2>A mock interview you answer by typing</h2>
            <p className="pg__muted">Raven asks questions planned from your profile (and the company, if you name one), scores each answer and debriefs you at the end.</p>
          </div>
        )}

        {debrief && (
          <div className="pg__card">
            <span className="pg__label">How it went</span>
            <p className="iv__summary">{debrief.summary}</p>
            <span className="pg__label">Before the real one</span>
            <Steps items={debrief.prepList} />
            {debrief.savedToMemory > 0 && (
              <p className="pg__label">Raven noted {debrief.savedToMemory} pattern{debrief.savedToMemory === 1 ? '' : 's'} to work on next time. See them under You.</p>
            )}
            <button type="button" className="ob__next db__start" onClick={reset}>Practise again</button>
          </div>
        )}

        {session && !debrief && (
          <>
            <div className="pg__row-head">
              <span className="pg__label">Question {index + 1} of {total}</span>
              <div className="iv__progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={index + 1} aria-label="Interview progress">
                {session.questions.map((_, i) => <i key={i} className={i < index || (i === index && answered) ? 'is-done' : i === index ? 'is-now' : ''} />)}
              </div>
            </div>

            <form className="pg__card iv__ask" onSubmit={submit}>
              {SOURCES[question.source] && <span className="pg__pill">{SOURCES[question.source]}</span>}
              {index === 0 && session.opening && <p className="pg__muted">{session.opening}</p>}
              <h2 className="iv__question">{question.text}</h2>
              <label className="ob__field" htmlFor="practice-answer"><span>Your answer</span></label>
              <textarea
                id="practice-answer"
                className="db__answer"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type as you would say it. Try: the situation, what you did, how it turned out."
                rows={6}
                maxLength={4000}
                readOnly={Boolean(answered)}
              />
              <div className="iv__actions">
                {results.some(Boolean) && !(answered && last) ? (
                  <button type="button" className="iv__quiet" onClick={finish} disabled={busy === 'finish'}>
                    {busy === 'finish' ? 'Writing your debrief…' : 'End early and debrief'}
                  </button>
                ) : <span />}
                {!answered && (
                  <button type="submit" className="ob__next" disabled={busy === 'turn' || !answer.trim()}>{busy === 'turn' ? 'Scoring…' : 'Submit answer'}</button>
                )}
                {answered && !last && <button type="button" className="ob__next" onClick={next}>Next question</button>}
                {answered && last && (
                  <button type="button" className="ob__next" onClick={finish} disabled={busy === 'finish'}>{busy === 'finish' ? 'Writing your debrief…' : 'Finish and debrief'}</button>
                )}
              </div>
            </form>

            {answered && <Scores result={answered} n={index + 1} />}
            {busy === 'finish' && <Thinking>Raven is looking for patterns across your answers…</Thinking>}
          </>
        )}
        <Problem error={error} />
      </section>
    </div>
  )
}

const MODES = [
  ['prep', 'Prep questions'],
  ['mock', 'Mock interview'],
]

/** Prep and the mock interview on one page; both stay mounted so switching modes keeps what's in progress. */
export default function Interview({ mode, onMode, userId, stamp, defaultRole, preset, onPractice }) {
  return (
    <div className="pg">
      <PageHead
        title="Practise for the exact role."
        lead="Questions start with ones real candidates were asked, then fill in with your weak spots. Prefer speaking? Use the iOS app or the Quest headset."
      >
        <div className="iv__modes" role="group" aria-label="Mode">
          {MODES.map(([id, label]) => (
            <button key={id} type="button" className={mode === id ? 'is-on' : ''} aria-pressed={mode === id} onClick={() => onMode(id)}>{label}</button>
          ))}
        </div>
      </PageHead>
      <div hidden={mode !== 'prep'}>
        <InterviewPrep userId={userId} stamp={stamp} defaultRole={defaultRole} onPractice={onPractice} />
      </div>
      <div hidden={mode !== 'mock'}>
        <Practice key={preset?.key ?? 'practice'} defaultRole={defaultRole} preset={preset} />
      </div>
    </div>
  )
}
