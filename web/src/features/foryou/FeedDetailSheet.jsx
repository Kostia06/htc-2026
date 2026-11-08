// FeedDetailSheet.swift at /for-you/:cardId: why it fits, the facts, the listing's own description, and one way out.
import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router'
import { Bookmark, Check } from 'lucide-react'
import { feedApi, safeUrl } from '../../lib/client'
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
  const { findCard, toggleSaved, loaded } = useOutletContext()
  const id = decodeURIComponent(cardId)
  // a notification can point at a card past the loaded pages; that one is fetched on its own
  const [fetched, setFetched] = useState(null)
  const listed = findCard(id)
  const card = listed ?? (fetched?.id === id ? fetched : null)
  const close = () => navigate({ pathname: '/for-you', search: params.toString() })

  useEffect(() => {
    if (!loaded || listed) return undefined
    let live = true
    feedApi
      .item(id)
      .then((item) => live && setFetched(item))
      .catch(() => live && navigate({ pathname: '/for-you', search: params.toString() }, { replace: true }))
    return () => {
      live = false
    }
  }, [loaded, listed, id, navigate, params])

  const toggle = () => {
    toggleSaved(card)
    if (!listed) setFetched({ ...card, saved: !card.saved })
  }

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
          <RaisedButton variant="secondary" className="feed-sheet__save" onClick={toggle} aria-label={card.saved ? 'Remove from Saved' : 'Save'}>
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
              <Check size={17} strokeWidth={2.6} className="c-agent" aria-hidden />
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
