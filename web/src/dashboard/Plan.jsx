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
  if (!total) return 'Raven is reading your answers and lining up your first moves.'
  if (left === 0) return `All ${count(total).toLowerCase()} done. Nice work. Refresh the plan when you're ready for more.`
  if (left === 1) return 'One move left. Small steps, each one built on the last.'
  return `${count(left)} moves left. Start at the top: each one builds on the last.`
}

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
  const next = steps[0]

  return (
    <div className="pl">
      <section className="pl__hero">
        <span className="pl__pill">
          <i aria-hidden="true" />
          {aim ? `On the way to ${aim}` : 'Your career plan'}
        </span>
        <h1 className="pl__title">{title}</h1>
        <p className="pl__sub">{subline(steps.length, steps.length)}</p>
      </section>

      <div className="pl__grid">
        <section className="pl__moves" aria-labelledby="pl-moves">
          <div className="pl__head">
            <h2 id="pl-moves">Your moves</h2>
          </div>

          {busy && !output && <Thinking>Raven is reading your profile and building your plan…</Thinking>}
          <Problem error={state.status === 'error' && state.error} onRetry={() => run()} />

          {steps.map((s, i) => {
            const link = linkFor(s.step)
            return (
              <article key={i} className="pl__card">
                <span className="pl__check">{i + 1}</span>
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
