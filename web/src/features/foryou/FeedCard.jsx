// FeedCardView.swift: kind badge, title, where, the sand "why" line and a few chips. Swipe right to save and left to
// dismiss on touch screens; on a desktop the dismiss button shows on hover.
import { useRef } from 'react'
import { Bookmark, Calendar, Clock, DollarSign, Leaf, X } from 'lucide-react'
import { safeUrl } from '../../lib/client'
import { Chip } from '../../ui/Controls'
import { cardDate, feedKind, whenText } from './kinds'

const SWIPE = 0.32

export function KindBadge({ card, size = 44 }) {
  const { icon: Icon, tint } = feedKind(card)
  return (
    <span className="kind-badge" style={{ width: size, height: size, color: tint }}>
      <Icon size={size * 0.42} strokeWidth={2.4} aria-hidden />
    </span>
  )
}

export function BookmarkButton({ saved, onClick, className = '' }) {
  return (
    <button
      type="button"
      className={`bookmark${saved ? ' is-saved' : ''} ${className}`}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      aria-label={saved ? 'Saved' : 'Save'}
      aria-pressed={saved}
    >
      <Bookmark size={20} strokeWidth={2.2} fill={saved ? 'currentColor' : 'none'} aria-hidden />
    </button>
  )
}

export default function FeedCard({ card, inSaved, onOpen, onSave, onDismiss }) {
  const node = useRef(null)
  const drag = useRef(null)
  const when = whenText(card)

  const setOffset = (dx, animate) => {
    const el = node.current
    if (!el) return
    el.style.transition = animate ? 'transform 0.3s var(--smooth)' : 'none'
    el.style.transform = dx ? `translateX(${dx}px)` : ''
    el.parentElement.dataset.swipe = dx > 24 ? 'save' : dx < -24 ? 'dismiss' : ''
  }

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse') return
    drag.current = { x: e.clientX, y: e.clientY, dx: 0, active: false }
  }
  const onPointerMove = (e) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.active) {
      if (Math.abs(dy) > 10) {
        drag.current = null
        return
      }
      if (Math.abs(dx) < 10) return
      d.active = true
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    d.dx = dx
    setOffset(dx, false)
  }
  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    if (!d?.active) return
    const width = node.current?.offsetWidth ?? 1
    if (d.dx > width * SWIPE) {
      setOffset(0, true)
      onSave()
    } else if (d.dx < -width * SWIPE) {
      setOffset(-width * 1.2, true)
      setTimeout(onDismiss, 200)
    } else setOffset(0, true)
  }

  return (
    <div className="feed-card-wrap">
      <div className="feed-card-wrap__actions" aria-hidden>
        <span className="is-save">
          <Bookmark size={18} fill="currentColor" /> Save
        </span>
        <span className="is-dismiss">
          {inSaved ? 'Remove' : 'Dismiss'} <X size={18} />
        </span>
      </div>
      <article
        ref={node}
        className="card feed-card"
        onClick={(e) => {
          if (!drag.current?.active && !e.defaultPrevented) onOpen()
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onOpen()
          }
        }}
        aria-label={`${card.title}, ${card.org}`}
      >
        <KindBadge card={card} />
        <div className="feed-card__details">
          <div className="feed-card__top">
            <div className="grow">
              <h3 className="t-headline clamp-2">{card.title}</h3>
              <p className="t-subhead c-2 clamp-1">{[card.org, card.where].filter(Boolean).join(' · ')}</p>
            </div>
            <BookmarkButton saved={Boolean(card.saved)} onClick={onSave} className="feed-card__bookmark" />
          </div>
          {card.why && <p className="t-footnote c-agent clamp-1">{card.why}</p>}
          <div className="feed-card__chips">
            {card.level === 'beginner' && <Chip icon={Leaf}>Beginner friendly</Chip>}
            {when && <Chip icon={cardDate(card) ? Calendar : Clock}>{when}</Chip>}
            {card.salary && <Chip icon={DollarSign}>{card.salary.replace(/^\$/, '')}</Chip>}
          </div>
          {/* Adzuna's terms ask for the credit wherever its listings are shown, not only at the end of the list */}
          {card.attribution && safeUrl(card.attribution.url) && (
            <a
              href={card.attribution.url}
              target="_blank"
              rel="noreferrer"
              className="feed-card__credit t-caption c-2"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {card.attribution.label}
            </a>
          )}
        </div>
        <button
          type="button"
          className="feed-card__dismiss"
          onClick={(e) => {
            e.stopPropagation()
            onDismiss()
          }}
          aria-label={inSaved ? 'Remove' : 'Not for me'}
          title={inSaved ? 'Remove' : 'Not for me'}
        >
          <X size={16} strokeWidth={2.4} aria-hidden />
        </button>
      </article>
    </div>
  )
}
