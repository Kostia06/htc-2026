import { useState } from 'react'
import { useSkill } from './useSkill'
import { safeUrl } from '../lib/agent'
import { PageHead, Problem, Thinking, Updated } from './ui'
import './jobs.css'

// recommend-jobs, recommend-courses and recommend-research share one output: items the server has checked
// against the page they came from and against the person's profile, each with a fixed honesty level.
const LEVELS = [
  ['ready_now', 'Ready now', 'You meet most of what it asks for. Worth going for now.'],
  ['stretch', 'Stretch', 'A few gaps you could close in weeks.'],
  ['long_term', 'Long term', 'Worth knowing about, not worth going for yet.'],
  ['cant_tell', "Can't tell yet", 'The page is too vague to check honestly.'],
]
const LEVEL_NAME = Object.fromEntries(LEVELS.map(([k, name]) => [k, name]))

const Dot = ({ level }) => <span className={`jb__dot jb__dot--${level}`} aria-hidden="true" />

function Requirement({ mark, kind, text, note }) {
  return (
    <li className="jb__req">
      <span className={`jb__mark jb__mark--${kind}`} aria-hidden="true">{mark}</span>
      <span>
        <span className="jb__quote">“{text}”</span>
        {note && <span className="jb__note">{note}</span>}
      </span>
    </li>
  )
}

function Item({ item, open, onToggle, onPractise }) {
  const url = safeUrl(item.source_url)
  const reqs = [
    ...(item.matched ?? []).map((m) => ({ mark: '✓', kind: 'met', text: m.requirement, note: m.evidence ? `From your profile: ${m.evidence}` : 'Matches your profile.' })),
    ...(item.missing ?? []).map((m) => ({ mark: '–', kind: 'missing', text: m.requirement, note: m.kind === 'hard' ? 'Must have, and not on your profile yet.' : 'Not on your profile yet.' })),
    ...(item.unknown ?? []).map((m) => ({ mark: '·', kind: 'unknown', text: m.requirement, note: "Skillit couldn't check this one against your profile." })),
  ]

  return (
    <article className={`jb__item${open ? ' is-open' : ''}`}>
      <button type="button" className="jb__summary" onClick={onToggle} aria-expanded={open}>
        <span className="jb__name">
          <span className="jb__title">{item.title}</span>
          {item.label && <span className="jb__sub">{item.label}</span>}
        </span>
        {item.counts?.summary && <span className="jb__met">{item.counts.summary}</span>}
        <span className="jb__badge"><Dot level={item.level} />{LEVEL_NAME[item.level] ?? item.level}</span>
      </button>
      {open && (
        <div className="jb__detail">
          {reqs.length > 0 && (
            <>
              <span className="pg__label">From the page, checked against your profile</span>
              <ul className="jb__reqs">
                {reqs.map((r, i) => <Requirement key={i} {...r} />)}
              </ul>
            </>
          )}
          {item.note && <p className="pg__muted">{item.note}</p>}
          {item.next_step && <p className="jb__next"><strong>Next</strong> {item.next_step}</p>}
          {(url || onPractise) && (
            <div className="db__row">
              {url && <a className="db__ghost" href={url} target="_blank" rel="noreferrer noopener">Open the page</a>}
              {onPractise && <button type="button" className="db__ghost" onClick={() => onPractise(item.title)}>Practise for this role</button>}
            </div>
          )}
        </div>
      )}
    </article>
  )
}

/**
 * One recommendation page. `field` is the skill's single text input (query or interest), prefilled from the profile.
 */
export default function Recommendations({ userId, stamp, skill, field, heading, label, placeholder, initial, intro, empty, onPractise }) {
  const start = initial?.trim().slice(0, 200)
  const [state, run] = useSkill({ userId, stamp, key: skill, skill, auto: start ? { [field]: start } : true })
  const [text, setText] = useState(state.input?.[field] ?? start ?? '')
  const [filter, setFilter] = useState('all')
  const [open, setOpen] = useState(0)
  const busy = state.status === 'loading'
  const search = (e) => {
    e?.preventDefault()
    setFilter('all')
    setOpen(0)
    run(text.trim() ? { [field]: text.trim().slice(0, 200) } : {})
  }
  const output = state.output
  const items = (output?.items ?? []).map((item, i) => ({ item, i }))
  const shown = items.filter(({ item }) => filter === 'all' || item.level === filter)
  const filters = [['all', 'All', items.length], ...LEVELS.map(([k, name]) => [k, name, items.filter(({ item }) => item.level === k).length])].filter(
    ([k, , n]) => k === 'all' || n > 0,
  )

  return (
    <div className="pg">
      <PageHead title={heading} lead={intro} />

      <form className="jb__search" onSubmit={search}>
        <label className="ob__sr" htmlFor={`${skill}-q`}>{label}</label>
        <input id={`${skill}-q`} type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} maxLength={200} />
        <button type="submit" className="ob__next" disabled={busy}>{busy ? 'Looking…' : 'Find'}</button>
      </form>

      {output && !busy && items.length > 1 && (
        <div className="jb__filters" role="group" aria-label="Filter by label">
          {filters.map(([k, name, n]) => (
            <button key={k} type="button" className={`jb__filter${filter === k ? ' is-on' : ''}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>
              {name} <span>{n}</span>
            </button>
          ))}
        </div>
      )}

      <div className="pg__grid">
        <section className="pg__main" aria-label="Results">
          {busy && <Thinking>Skillit is finding and checking options for you…</Thinking>}
          <Problem error={state.status === 'error' && state.error} onRetry={search} />

          {output && !busy && (
            <>
              {output.question && (
                <div className="jb__ask">
                  <span className="pg__label">Skillit needs to know</span>
                  <p>{output.question}</p>
                </div>
              )}
              {items.length === 0 && <p className="pg__muted">{empty}</p>}
              {shown.map(({ item, i }) => (
                <Item key={`${item.source_url}-${i}`} item={item} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)} onPractise={onPractise} />
              ))}
              {output.not_a_fit?.length > 0 && (
                <details className="db__details jb__more">
                  <summary>{output.not_a_fit.length} more that aren't a fit right now</summary>
                  <ul>
                    {output.not_a_fit.map((n, i) => (
                      <li key={i}>
                        {safeUrl(n.source_url) ? <a href={n.source_url} target="_blank" rel="noreferrer noopener">{n.title}</a> : n.title}
                        <span className="db__muted"> · {n.reason}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <div className="jb__foot"><Updated at={state.at} onRefresh={search} busy={busy} /></div>
            </>
          )}
        </section>

        <aside className="pg__side pg__card" aria-label="What the labels mean">
          <h2>What the labels mean</h2>
          {LEVELS.map(([k, name, desc]) => (
            <div key={k} className="jb__legend">
              <Dot level={k} />
              <span>
                <span>{name}</span>
                <span className="jb__note">{desc}</span>
              </span>
            </div>
          ))}
        </aside>
      </div>
    </div>
  )
}
