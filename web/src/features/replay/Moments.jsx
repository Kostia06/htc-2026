// MomentRow.swift + MomentCard: the notification-style feed of moments and the open one under the bar.
import { Link2 } from 'lucide-react'
import { KINDS, momentId, sourceHost, spokenLabel, when } from './replay'

function Glyph({ kind }) {
  const { icon: Icon, color } = KINDS[kind] ?? KINDS.delivery
  return (
    <span className="moment-glyph" style={{ '--tint': color }} aria-hidden>
      <Icon size={15} strokeWidth={2.6} />
    </span>
  )
}

// a tip only carries this when it cites a page the server read, so it never dresses a guess up as research
const ResearchedBadge = () => <span className="t-caption semibold researched-badge">Researched</span>

function SourceChips({ sources }) {
  return (
    <div className="source-chips">
      {sources.map((s) => (
        <a key={s.url} className="source-chip t-caption medium" href={s.url} target="_blank" rel="noopener noreferrer" aria-label={`Source: ${s.title}`}>
          <Link2 size={12} strokeWidth={2.4} aria-hidden /> {sourceHost(s.url)}
        </a>
      ))}
    </div>
  )
}

export function MomentFeed({ replay, selectedId, onSelect }) {
  if (!replay.moments.length) return <p className="t-subhead c-2">Nothing stood out in this one.</p>
  return (
    <ul className="moment-feed">
      {replay.moments.map((m) => {
        const id = momentId(m)
        return (
          <li key={id}>
            <button
              type="button"
              className={`moment-row${id === selectedId ? ' is-selected' : ''}`}
              aria-label={spokenLabel(replay, m)}
              aria-pressed={id === selectedId}
              onClick={() => onSelect(m)}
            >
              <Glyph kind={m.kind} />
              <span className="moment-row__text">
                <span className="row moment-row__top">
                  <span className="t-subhead semibold grow">{m.title}</span>
                  {m.kind === 'researched' && <ResearchedBadge />}
                  <span className="t-caption c-2 mono">{when(replay, m)}</span>
                </span>
                <span className="t-subhead c-2 moment-row__detail">{m.detail}</span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export function MomentCard({ replay, moment }) {
  return (
    <div className="moment-card" aria-live="polite">
      <div className="row moment-card__head">
        <Glyph kind={moment.kind} />
        <span className="t-headline grow">{moment.title}</span>
        <span className="t-caption c-2 mono">{when(replay, moment)}</span>
      </div>
      {moment.kind === 'researched' && <ResearchedBadge />}
      <p className="t-body">{moment.detail}</p>
      {moment.said && <p className="t-subhead c-2">You said &ldquo;{moment.said}&rdquo;</p>}
      {moment.better && (
        <div className="moment-card__better">
          <span className="t-caption semibold c-agent">Try saying</span>
          <p className="t-subhead">{moment.better}</p>
        </div>
      )}
      {moment.sources?.length > 0 && <SourceChips sources={moment.sources} />}
      <p className="t-caption c-3">{moment.question}</p>
    </div>
  )
}
