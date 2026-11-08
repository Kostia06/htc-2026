import { useState } from 'react'
import { useSkill } from './useSkill'
import { Problem, Thinking, Updated } from './ui'
import './plan.css'

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five']
const count = (n) => WORDS[n] ?? String(n)

// a step that clearly points at another tab gets a button there; the rest stand on their own
const LINKS = [
  [/resum|\bcv\b|cover letter/i, 'resume', 'Open your resume'],
  [/mock interview|practi[cs]e (an |your )?interview|interview practi/i, 'practice', 'Start practice'],
  [/interview/i, 'prep', 'Prep for interviews'],
  [/\bjobs?\b|posting|apply|application/i, 'jobs', 'See jobs'],
  [/course/i, 'courses', 'See courses'],
  [/research/i, 'research', 'See research'],
]
const linkFor = (text = '') => LINKS.find(([re]) => re.test(text))

function subline(total, left) {
  if (!total) return 'Skillit is reading your answers and lining up your first moves.'
  if (left === 0) return `All ${count(total).toLowerCase()} done. Nice work. Refresh the plan when you're ready for more.`
  if (left === 1) return 'One move left. Small steps, each one built on the last.'
  return `${count(left)} moves left. Start at the top: each one builds on the last.`
}

// which moves are ticked off, kept on this device next to the plan they belong to; a refreshed plan starts clean
const doneKey = (userId, stamp) => `raven-ai:${userId}:${stamp}:plan-done`

function useDone(userId, stamp, at) {
  const k = doneKey(userId, stamp)
  const [saved, setSaved] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(k) ?? 'null')
    } catch {
      return null
    }
  })
  const done = new Set(saved?.at === at ? saved.done : [])
  const toggle = (i) => {
    const next = new Set(done)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    const value = { at, done: [...next] }
    setSaved(value)
    try {
      localStorage.setItem(k, JSON.stringify(value))
    } catch {
      // private mode: ticks still show, they just aren't kept
    }
  }
  return [done, toggle]
}

const Check = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12l5 5L20 7" />
  </svg>
)

/** career-snapshot: the first thing someone sees after onboarding, run automatically from the profile they just saved. */
export default function Plan({ userId, stamp, first, role, onGo }) {
  const [state, run] = useSkill({ userId, stamp, key: 'career-snapshot', skill: 'career-snapshot', auto: true })
  const busy = state.status === 'loading'
  const output = state.output
  const roles = output?.targetRoles ?? []
  const steps = output?.nextSteps ?? []
  const aim = roles[0] || role
  const name = first ? `, ${first}` : ''
  const title = steps.length ? `Your next ${count(steps.length).toLowerCase()} moves${name}.` : `Building your plan${name}.`
  const [done, toggle] = useDone(userId, stamp, state.at)
  const left = steps.length - steps.filter((_, i) => done.has(i)).length
  const nextIndex = steps.findIndex((_, i) => !done.has(i))
  const next = steps[nextIndex]

  return (
    <div className="pl">
      <section className="pl__hero">
        <span className="pl__pill">
          <i aria-hidden="true" />
          {aim ? `On the way to ${aim}` : 'Your career plan'}
        </span>
        <h1 className="pl__title">{title}</h1>
        <p className="pl__sub">{subline(steps.length, left)}</p>
      </section>

      <div className="pl__grid">
        <section className="pl__moves" aria-labelledby="pl-moves">
          <div className="pl__head">
            <h2 id="pl-moves">Your moves</h2>
            {steps.length > 0 && <span>{steps.length - left} of {steps.length} done</span>}
          </div>

          {busy && !output && <Thinking>Skillit is reading your profile and building your plan…</Thinking>}
          <Problem error={state.status === 'error' && state.error} onRetry={() => run()} />

          {steps.map((s, i) => {
            const link = linkFor(s.step)
            const isDone = done.has(i)
            return (
              <article key={i} className={`pl__card${isDone ? ' is-done' : ''}`}>
                <button type="button" className="pl__check" onClick={() => toggle(i)} aria-pressed={isDone} aria-label={`${isDone ? 'Mark as not done' : 'Mark as done'}: ${s.step}`}>
                  {isDone ? <Check /> : i + 1}
                </button>
                <div className="pl__body">
                  <h3>{s.step}</h3>
                  {s.why && <p>{s.why}</p>}
                  {link && (
                    <div className="pl__actions">
                      <button type="button" className="pl__btn pl__btn--ghost" onClick={() => onGo(link[1])}>{link[2]}</button>
                    </div>
                  )}
                </div>
              </article>
            )
          })}

          {output && (
            <div className="pl__foot">
              <Updated at={state.at} onRefresh={() => run()} busy={busy} />
              {busy && <Thinking>Refreshing your plan…</Thinking>}
            </div>
          )}
        </section>

        <aside className="pl__side" aria-label="Around your plan">
          {roles.length > 0 && (
            <section className="pl__panel">
              <span className="pl__label">Roles to aim for</span>
              <ul className="pl__roles">
                {roles.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </section>
          )}

          {next && (
            <section className="pl__panel">
              <span className="pl__label">Next up</span>
              <h2>{next.step}</h2>
              <button type="button" className="pl__btn pl__btn--primary" onClick={() => toggle(nextIndex)}>Mark as done</button>
            </section>
          )}

          {steps.length > 0 && !next && (
            <section className="pl__panel">
              <span className="pl__label">All done</span>
              <h2>Every move is ticked off.</h2>
              <p>Ask Skillit for a fresh plan built on where you are now.</p>
              <button type="button" className="pl__btn pl__btn--primary" onClick={() => run()} disabled={busy}>{busy ? 'Building…' : 'Refresh my plan'}</button>
            </section>
          )}

          <nav className="pl__links" aria-label="Shortcuts">
            <button type="button" onClick={() => onGo('practice')}>Practise an interview <span aria-hidden="true">→</span></button>
            <button type="button" onClick={() => onGo('resume')}>Polish your resume <span aria-hidden="true">→</span></button>
            <button type="button" onClick={() => onGo('jobs')}>See jobs that fit <span aria-hidden="true">→</span></button>
            <button type="button" onClick={() => onGo('prep')}>Prepare for an interview <span aria-hidden="true">→</span></button>
          </nav>
        </aside>
      </div>
    </div>
  )
}
