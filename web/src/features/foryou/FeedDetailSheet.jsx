// FeedDetailSheet.swift at /for-you/:cardId: why it fits, the facts, the listing's own description, and one way out.
import { useEffect } from 'react'
import { useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router'
import { Bookmark, Check, CircleCheck } from 'lucide-react'
import { safeUrl } from '../../lib/client'
import { capitalized } from '../../lib/format'
import { RaisedButton } from '../../ui/Button'
import { ExpandableText, FactGrid } from '../../ui/Controls'
import { SkeletonLines } from '../../ui/Feedback'
import { Sheet } from '../../ui/Sheet'
import { KindBadge } from './FeedCard'
import { feedKind, whenText } from './kinds'

export default function FeedDetailSheet() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { cardId } = useParams()
  const { findCard, save, loaded } = useOutletContext()
  const card = findCard(decodeURIComponent(cardId))
  const close = () => navigate({ pathname: '/for-you', search: params.toString() })

  useEffect(() => {
    if (loaded && !card) navigate({ pathname: '/for-you', search: params.toString() }, { replace: true })
  }, [loaded, card, navigate, params])

  if (!card)
    return (
      <Sheet onClose={close} label="Details">
        <SkeletonLines />
      </Sheet>
    )

  const kind = feedKind(card)
  const reasons = card.reasons?.length ? card.reasons : card.why ? [card.why] : []
  const url = safeUrl(card.url)
  const facts = [
    { label: 'Kind', value: kind.name },
    { label: 'Where', value: card.where },
    { label: card.kind === 'job' ? 'Posted' : 'When', value: whenText(card)?.replace(/^Posted /, '') },
    { label: 'Salary', value: card.salary },
    { label: 'Level', value: capitalized(card.level) },
    { label: 'Format', value: card.format },
  ]

  return (
    <Sheet
      onClose={close}
      label={card.title}
      footer={
        <div className="row feed-sheet__footer">
          <RaisedButton variant="secondary" className="feed-sheet__save" onClick={() => save(card)} aria-label={card.saved ? 'Saved' : 'Save'}>
            <Bookmark size={20} strokeWidth={2.2} fill={card.saved ? 'currentColor' : 'none'} className={card.saved ? 'c-action' : ''} aria-hidden />
          </RaisedButton>
          <RaisedButton disabled={!url} onClick={() => url && window.open(url, '_blank', 'noopener')}>
            {kind.cta}
          </RaisedButton>
        </div>
      }
    >
      <div className="row feed-sheet__head">
        <KindBadge card={card} />
        <div className="grow stack feed-sheet__titles">
          <h2 className="t-title2">{card.title}</h2>
          <p className="t-subhead c-2">{card.org}</p>
        </div>
      </div>

      {reasons.length > 0 && (
        <section className="fit-reasons">
          <h3 className="t-headline">Why it fits you</h3>
          {reasons.map((r) => (
            <p key={r} className="t-subhead fit-reasons__row">
              <CircleCheck size={17} strokeWidth={2.4} className="c-agent" aria-hidden />
              {r}
            </p>
          ))}
        </section>
      )}

      <FactGrid facts={facts} />

      {card.summary && <ExpandableText text={card.summary} />}

      {card.highlights?.length > 0 && (
        <ul className="feed-sheet__highlights">
          {card.highlights.map((h) => (
            <li key={h} className="t-subhead">
              <Check size={16} strokeWidth={2.6} className="c-action" aria-hidden /> {h}
            </li>
          ))}
        </ul>
      )}

      {card.kind !== 'job' && card.tags?.length > 0 && (
        <div className="feed-sheet__tags">
          {card.tags.map((t) => (
            <span key={t} className="chip t-subhead">
              {capitalized(t)}
            </span>
          ))}
        </div>
      )}

      {card.attribution && (
        <a href={card.attribution.url} target="_blank" rel="noreferrer" className="t-caption c-2">
          {card.attribution.label}
        </a>
      )}
    </Sheet>
  )
}
