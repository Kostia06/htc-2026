// Navigation chrome for a page: the iOS navigation bar (glass once content scrolls under it), the large title,
// and the rows and grouped sections the screens are built from.
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * `large` shows a 34px title that hands over to the inline one as it scrolls away.
 * `back` is { to, label } for pushed screens; `actions` sit on the right of the bar.
 */
export function PageHeader({ title, large = false, showTitle = true, back, actions, children }) {
  const sentinel = useRef(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const node = sentinel.current
    if (!node) return undefined
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting), { rootMargin: '-56px 0px 0px 0px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <div className={`nav-bar${scrolled ? ' is-scrolled' : ''}`}>
        <div className="nav-bar__side">
          {back && (
            <Link to={back.to} className="nav-bar__back">
              <ChevronLeft size={22} strokeWidth={2.4} aria-hidden />
              <span>{back.label}</span>
            </Link>
          )}
        </div>
        <div className={`nav-bar__title t-headline${(large ? scrolled : showTitle) ? ' is-shown' : ''}`} aria-hidden={large ? !scrolled : !showTitle}>
          {title}
        </div>
        <div className="nav-bar__side nav-bar__side--end">{actions}</div>
      </div>
      <div ref={sentinel} className="nav-sentinel" />
      {large && (
        <div className="large-title">
          <h1 className="t-large-title">{title}</h1>
          {children}
        </div>
      )}
      {!large && <h1 className="visually-hidden">{title}</h1>}
    </>
  )
}

/** A toolbar button for the navigation bar: icon, with the label shown on wide screens. */
export function BarButton({ icon: Icon, label, showLabel = false, ...props }) {
  return (
    <button type="button" className={`glass-button bar-btn${showLabel ? ' has-label' : ''}`} aria-label={label} title={label} {...props}>
      {Icon && <Icon size={18} strokeWidth={2.2} aria-hidden />}
      <span className="bar-btn__label">{label}</span>
    </button>
  )
}

/** A card row with an icon, a label and a chevron, like the Practice tab's links. */
export function NavRow({ icon: Icon, label, detail, to, onClick, className = '' }) {
  const body = (
    <>
      {Icon && <Icon size={20} strokeWidth={2} className="nav-row__icon" aria-hidden />}
      <span className="grow">
        <span className="t-body">{label}</span>
        {detail && <span className="t-footnote c-2 nav-row__detail">{detail}</span>}
      </span>
      <ChevronRight size={16} strokeWidth={2.6} className="c-3" aria-hidden />
    </>
  )
  return to ? (
    <Link to={to} className={`card nav-row ${className}`}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={`card nav-row ${className}`}>
      {body}
    </button>
  )
}

/** An insetGrouped List section: a small header, raised rows separated by hairlines, an optional footer. */
export function Group({ header, footer, children, className = '' }) {
  return (
    <section className={`group ${className}`}>
      {header && <h2 className="group__header t-footnote">{header}</h2>}
      <div className="group__rows">{children}</div>
      {footer && <p className="group__footer t-footnote c-2">{footer}</p>}
    </section>
  )
}

/** One row of a Group. Pass `to` or `onClick` to make it tappable; `chevron` adds the disclosure arrow. */
export function GroupRow({ to, onClick, chevron = Boolean(to), destructive, children, className = '', ...props }) {
  const content = (
    <>
      <span className="grow group-row__content">{children}</span>
      {chevron && <ChevronRight size={16} strokeWidth={2.6} className="c-3" aria-hidden />}
    </>
  )
  const cls = `group-row${destructive ? ' is-destructive' : ''}${to || onClick ? ' is-tappable' : ''} ${className}`
  if (to)
    return (
      <Link to={to} className={cls} {...props}>
        {content}
      </Link>
    )
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls} {...props}>
        {content}
      </button>
    )
  return (
    <div className={cls} {...props}>
      {content}
    </div>
  )
}

/** The content column every tab screen sits in. `wide` lets lists spread into two columns. */
export function Page({ children, wide = false, className = '' }) {
  // a screen opens at its top; sheets over it are child routes, so they leave it where it was
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  return <main className={`page${wide ? ' page--wide' : ''} ${className}`}>{children}</main>
}
