import { useState } from 'react'
import { useSkill } from './useSkill'
import { safeUrl } from '../lib/agent'
import { Problem, Thinking, Updated } from './ui'

// recommend-jobs, recommend-courses and recommend-research share one output: items the server has checked
// against the page they came from and against the person's profile, each with a fixed honesty level.
const LEVELS = {
  ready_now: 'Ready now',
  stretch: 'Stretch',
  long_term: 'Long term',
  cant_tell: "Can't tell yet",
}

function Item({ item }) {
  const url = safeUrl(item.source_url)
  return (
    <article className="db__item">
      <header className="db__item-head">
        <h3>{url ? <a href={url} target="_blank" rel="noreferrer noopener">{item.title}</a> : item.title}</h3>
        <span className={`db__level db__level--${item.level}`}>{LEVELS[item.level] ?? item.level}</span>
      </header>
      {item.label && <p className="db__muted">{item.label}</p>}
      {item.counts?.summary && <p className="db__counts">{item.counts.summary}</p>}
      {item.matched?.length > 0 && (
        <ul className="db__reqs db__reqs--met">
          {item.matched.map((m, i) => (
            <li key={i}>
              <span>{m.requirement}</span>
              {m.evidence && <em>“{m.evidence}”</em>}
            </li>
          ))}
        </ul>
      )}
      {item.missing?.length > 0 && (
        <ul className="db__reqs db__reqs--missing">
          {item.missing.map((m, i) => <li key={i}><span>{m.requirement}</span>{m.kind === 'hard' && <em>must have</em>}</li>)}
        </ul>
      )}
      {item.unknown?.length > 0 && (
        <ul className="db__reqs db__reqs--unknown">
          {item.unknown.map((m, i) => <li key={i}><span>{m.requirement}</span></li>)}
        </ul>
      )}
      {item.note && <p className="db__muted">{item.note}</p>}
      {item.next_step && <p className="db__next"><strong>Next:</strong> {item.next_step}</p>}
    </article>
  )
}

/**
 * One recommendation panel. `field` is the skill's single text input (query or interest), prefilled from the profile.
 */
export default function Recommendations({ userId, stamp, skill, field, label, placeholder, initial, intro, empty }) {
  const start = initial?.trim().slice(0, 200)
  const [state, run] = useSkill({ userId, stamp, key: skill, skill, auto: start ? { [field]: start } : true })
  const [text, setText] = useState(state.input?.[field] ?? start ?? '')
  const busy = state.status === 'loading'
  const search = (e) => {
    e?.preventDefault()
    run(text.trim() ? { [field]: text.trim().slice(0, 200) } : {})
  }
  const output = state.output
  const items = output?.items ?? []

  return (
    <div className="db__panel">
      <p className="db__intro">{intro}</p>
      <form className="db__search" onSubmit={search}>
        <label className="ob__sr" htmlFor={`${skill}-q`}>{label}</label>
        <input id={`${skill}-q`} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} maxLength={200} />
        <button type="submit" className="ob__next" disabled={busy}>{busy ? 'Looking…' : 'Find'}</button>
      </form>

      {busy && <Thinking>Raven is finding and checking options for you…</Thinking>}
      <Problem error={state.status === 'error' && state.error} onRetry={search} />

      {output && !busy && (
        <>
          {output.question && (
            <div className="db__ask">
              <strong>Raven needs to know</strong>
              <p>{output.question}</p>
            </div>
          )}
          {items.length === 0 && <p className="db__muted">{empty}</p>}
          <div className="db__items">
            {items.map((item, i) => <Item key={`${item.source_url}-${i}`} item={item} />)}
          </div>
          {output.not_a_fit?.length > 0 && (
            <details className="db__details">
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
          <Updated at={state.at} onRefresh={search} busy={busy} />
        </>
      )}
    </div>
  )
}
