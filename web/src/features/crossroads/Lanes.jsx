// The two lanes of Crossroads. An item that overlaps the other lane says so with a chip; hovering or focusing it
// lights up its partners across the road, and the answer to a question lights up what it cited.
import { ExternalLink, Link2, ThumbsUp, Trash2 } from 'lucide-react'
import { hostOf, safeUrl } from '../../lib/client'
import { KIND_LABELS, ageLabel, peopleLabel } from './links'

function itemClass(base, id, { lit, cited, active }) {
  let cls = base
  if (lit.has(id)) cls += ' is-lit'
  if (active && !lit.has(id)) cls += ' is-dim'
  if (cited.has(id)) cls += ' is-cited'
  return cls
}

function OverlapChip({ count, onClick }) {
  if (!count) return null
  return (
    <button type="button" className="xr-chip xr-chip--link" onClick={onClick} aria-label={`Overlaps with ${count} on the other side; show them`}>
      <Link2 size={13} strokeWidth={2.4} aria-hidden />
      {count === 1 ? 'overlaps 1' : `overlaps ${count}`}
    </button>
  )
}

const hoverProps = (id, onActive) => ({
  onMouseEnter: () => onActive(id),
  onMouseLeave: () => onActive(null),
  onFocus: () => onActive(id),
  onBlur: () => onActive(null),
})

export function YouLane({ items, partners, view, onActive, onForget }) {
  return (
    <section className="xr-lane xr-lane--you" aria-labelledby="xr-you">
      <header className="xr-lane__head">
        <h2 id="xr-you" className="t-title3">You</h2>
        <p className="t-footnote c-2">Only you can see this side.</p>
      </header>
      {items.length === 0 && <p className="t-subhead c-2 xr-empty">Nothing written down yet. Tell Skillit what you're working on and it shows up here.</p>}
      <ul className="xr-list">
        {items.map((item) => (
          <li key={item.id} className={itemClass('xr-item xr-item--you', item.id, view)} tabIndex={0} {...hoverProps(item.id, onActive)}>
            <p className="t-caption semibold c-2 xr-item__kind">{KIND_LABELS[item.kind] ?? item.kind}</p>
            <p className="t-callout">{item.text}</p>
            <div className="xr-item__foot">
              <OverlapChip count={partners.get(item.id)?.length} onClick={() => onActive(item.id)} />
              {item.source === 'memory' && (
                <button type="button" className="xr-icon-btn" onClick={() => onForget(item)} aria-label={`Forget “${item.text}”`} title="Forget">
                  <Trash2 size={15} strokeWidth={2.2} aria-hidden />
                </button>
              )}
              {item.source === 'profile' && <span className="t-caption c-3">From your profile</span>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Line({ line, partners, view, onActive, onMeToo }) {
  return (
    <li className={itemClass('xr-item', line.id, view)} tabIndex={0} {...hoverProps(line.id, onActive)}>
      <p className="t-caption semibold c-2 xr-item__kind">
        {KIND_LABELS[line.kind] ?? line.kind}
        {line.example && <span className="xr-tag">Example</span>}
      </p>
      <p className="t-callout">{line.text}</p>
      <div className="xr-item__foot">
        {line.people ? <span className="t-caption semibold c-positive">{peopleLabel(line.people)}</span> : null}
        <OverlapChip count={partners.get(line.id)?.length} onClick={() => onActive(line.id)} />
        {line.kind !== 'interview' && (
          <button type="button" className={`xr-chip xr-metoo${line.meToo ? ' is-on' : ''}`} aria-pressed={line.meToo} onClick={() => onMeToo(line)}>
            <ThumbsUp size={13} strokeWidth={2.4} aria-hidden />
            {line.meToo ? 'Me too' : "That's me too"}
          </button>
        )}
      </div>
    </li>
  )
}

function Fact({ fact, partners, view, onActive }) {
  const url = safeUrl(fact.sourceUrl)
  return (
    <li className={itemClass('xr-item xr-item--fact', fact.id, view)} tabIndex={0} {...hoverProps(fact.id, onActive)}>
      <p className="t-caption semibold c-2 xr-item__kind">{fact.company}</p>
      <p className="t-callout">{fact.text}</p>
      <div className="xr-item__foot">
        {url ? (
          <a className="t-caption c-action xr-source" href={url} target="_blank" rel="noreferrer noopener">
            {fact.sourceHost || hostOf(url)} <ExternalLink size={11} aria-hidden />
          </a>
        ) : (
          <span className="t-caption c-2">{fact.sourceHost}</span>
        )}
        <span className="t-caption c-3">{ageLabel(fact.ageDays)}</span>
        <OverlapChip count={partners.get(fact.id)?.length} onClick={() => onActive(fact.id)} />
      </div>
    </li>
  )
}

export function RoadLane({ road, lines, research, minPeople, partners, view, onActive, onMeToo }) {
  return (
    <section className="xr-lane xr-lane--road" aria-labelledby="xr-road">
      <header className="xr-lane__head">
        <h2 id="xr-road" className="t-title3">Everyone on your road</h2>
        <p className="t-footnote c-2">
          People heading to {road.laneName}. A count shows once {minPeople} different people stand behind a line; “Example” lines were written by
          Skillit and never count as people.
        </p>
      </header>
      {lines.length === 0 && <p className="t-subhead c-2 xr-empty">No one has left notes on this road yet.</p>}
      <ul className="xr-list">
        {lines.map((line) => (
          <Line key={line.id} line={line} partners={partners} view={view} onActive={onActive} onMeToo={onMeToo} />
        ))}
      </ul>
      {research.length > 0 && (
        <>
          <h3 className="t-headline xr-sub">Fresh from employers on this road</h3>
          <ul className="xr-list">
            {research.map((fact) => (
              <Fact key={fact.id} fact={fact} partners={partners} view={view} onActive={onActive} />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
