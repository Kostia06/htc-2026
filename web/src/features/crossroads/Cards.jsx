// The cards on Crossroads: each says what it is, why it's shown, and offers one thing to do.
import { Check, ExternalLink, Hand, Link2, Plus, Trash2, Users } from 'lucide-react'
import { safeUrl } from '../../lib/client'
import { KIND_LABELS, factReason, isAddable, lineReason } from './links'

export const ExampleTag = () => (
  <span className="xr-tag" title="Written by Skillit, not a real person">
    Example
  </span>
)

function Reason({ text, isMatch }) {
  if (!text) return null
  const Icon = isMatch ? Link2 : Users
  return (
    <p className={`t-footnote c-2 xr-reason${isMatch ? ' is-match' : ''}`}>
      <Icon size={14} strokeWidth={2.2} aria-hidden />
      {text}
    </p>
  )
}

function Action({ on, onClick, label, onLabel, icon: Icon, disabled }) {
  return (
    <button type="button" className={`xr-action${on ? ' is-on' : ''}`} aria-pressed={on} onClick={onClick} disabled={disabled}>
      {on ? <Check size={15} strokeWidth={2.6} aria-hidden /> : <Icon size={15} strokeWidth={2.4} aria-hidden />}
      {on ? onLabel : label}
    </button>
  )
}

export function LineCard({ line, match, cited, onRoad, onMeToo, onAdd }) {
  return (
    <li className={`xr-card${cited ? ' is-cited' : ''}`}>
      <p className={`t-caption semibold xr-card__kind xr-kind--${line.kind}`}>
        {KIND_LABELS[line.kind] ?? line.kind}
        {line.example && <ExampleTag />}
      </p>
      <p className="t-body">{line.text}</p>
      <Reason text={lineReason(line, match)} isMatch={Boolean(match)} />
      {isAddable(line) ? (
        <Action on={onRoad} disabled={onRoad} onClick={() => onAdd(line)} label="Add to my road" onLabel="On your road" icon={Plus} />
      ) : (
        <Action on={line.meToo} onClick={() => onMeToo(line)} label="That's me too" onLabel="Me too" icon={Hand} />
      )}
    </li>
  )
}

export function FactCard({ fact, match, cited }) {
  const url = safeUrl(fact.sourceUrl)
  return (
    <li className={`xr-card${cited ? ' is-cited' : ''}`}>
      <p className="t-caption semibold c-2 xr-card__kind">{fact.company}</p>
      <p className="t-body">{fact.text}</p>
      <Reason text={factReason(fact, match)} isMatch={Boolean(match)} />
      {url && (
        <a className="t-footnote semibold c-action xr-source" href={url} target="_blank" rel="noreferrer noopener">
          Source: {fact.sourceHost} <ExternalLink size={12} aria-hidden />
        </a>
      )}
    </li>
  )
}

export function YourCard({ item, cited, onForget }) {
  return (
    <li className={`xr-card xr-card--you${cited ? ' is-cited' : ''}`}>
      <p className="t-caption semibold c-action xr-card__kind">{KIND_LABELS[item.kind] ?? item.kind}</p>
      <p className="t-body">{item.text}</p>
      {item.source === 'memory' ? (
        <button type="button" className="xr-forget" onClick={() => onForget(item)} aria-label={`Delete “${item.text}”`}>
          <Trash2 size={14} strokeWidth={2.2} aria-hidden /> Delete
        </button>
      ) : (
        <p className="t-caption c-3">From your profile</p>
      )}
    </li>
  )
}

/** An empty section that says how it fills up, so a new person knows what to do. */
export function TeachingEmpty({ children }) {
  return <p className="t-subhead c-2 xr-teach">{children}</p>
}
