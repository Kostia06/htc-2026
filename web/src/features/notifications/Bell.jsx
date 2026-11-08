// The bell in the corner of every screen, with the same rows as the iOS notification center in a dropdown.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  Bell as BellIcon,
  Building2,
  CalendarClock,
  FileText,
  GalleryVerticalEnd,
  MessageCircleQuestion,
  NotebookText,
  Route,
} from 'lucide-react'
import { relative } from '../../lib/format'
import { groupByDay, pathFor, useNotifications } from './useNotifications'
import './notifications.css'

// sand for what Skillit made, teal for good news arriving, coral only for time running out
const KINDS = {
  report_ready: { icon: NotebookText, tint: 'var(--agent)' },
  resume_ready: { icon: FileText, tint: 'var(--agent)' },
  deadline: { icon: CalendarClock, tint: 'var(--negative)' },
  road_nudge: { icon: Route, tint: 'var(--action)' },
  interview_question: { icon: MessageCircleQuestion, tint: 'var(--text-2)' },
  company_news: { icon: Building2, tint: 'var(--text-2)' },
  feed_match: { icon: GalleryVerticalEnd, tint: 'var(--positive)' },
}
const FALLBACK = { icon: BellIcon, tint: 'var(--text-2)' }

export function Bell() {
  const { items, unread, error, loaded, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => !root.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const openItem = (item) => {
    markRead(item)
    const path = pathFor(item.target)
    setOpen(false)
    if (path) navigate(path)
  }

  return (
    <div className="bell" ref={root}>
      <button
        type="button"
        className="bell__button glass-strong"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <BellIcon size={20} strokeWidth={2.1} aria-hidden />
        {unread > 0 && <span className="bell__dot" aria-hidden />}
      </button>
      {open && (
        <div className="bell__panel glass-strong" role="dialog" aria-label="Notifications">
          <header className="bell__header">
            <h2>Notifications</h2>
            <button type="button" className="bell__all" onClick={markAllRead} disabled={unread === 0}>
              Mark all read
            </button>
          </header>
          <div className="bell__list">
            {items.length === 0 ? (
              <p className="bell__empty">
                {!loaded ? 'Loading…' : error ?? 'Nothing new yet. Deadlines you saved, new interview questions and finished reports show up here.'}
              </p>
            ) : (
              groupByDay(items).map((group) => (
                <section key={group.title}>
                  <h3 className="bell__group">{group.title}</h3>
                  <ul>
                    {group.items.map((item) => (
                      <li key={item.id}>
                        <Row item={item} onOpen={() => openItem(item)} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ item, onOpen }) {
  const { icon: Icon, tint } = KINDS[item.kind] ?? FALLBACK
  const unread = !item.readAt
  return (
    <button type="button" className={`bell__row${unread ? ' is-unread' : ''}`} onClick={onOpen}>
      <span className="bell__icon" style={{ color: tint }} aria-hidden>
        <Icon size={18} strokeWidth={2.1} />
      </span>
      <span className="bell__text">
        <span className="bell__title">
          {unread && <span className="visually-hidden">Unread: </span>}
          {item.title}
        </span>
        <span className="bell__why">{item.body}</span>
      </span>
      <span className="bell__time">{relative(item.createdAt)}</span>
    </button>
  )
}
