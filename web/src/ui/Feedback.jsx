// Loading, empty and passing states: Skeleton.swift, ThinProgressBar.swift, ContentUnavailableView, the "Saved" flash.
import { useEffect } from 'react'

/** Capsules 10px tall; the bar at `highlighted` is sand so the screen reads as Raven working. Pass -1 for none. */
export function SkeletonLines({ widths = [0.9, 0.7, 0.8, 0.5], highlighted = 2 }) {
  return (
    <div className="skeleton" role="progressbar" aria-label="Loading">
      {widths.map((w, i) => (
        <span key={i} className={i === highlighted ? 'is-agent' : undefined} style={{ width: `${w * 85}%` }} />
      ))}
    </div>
  )
}

export function SkeletonCard(props) {
  return (
    <div className="card">
      <SkeletonLines {...props} />
    </div>
  )
}

/** A 4px capsule that always shows at least a sliver. */
export function ThinProgressBar({ value, tint = 'var(--action)', label }) {
  const fraction = Math.min(1, Math.max(0.02, Number.isFinite(value) ? value : 0))
  return (
    <div
      className="thin-bar"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round((value || 0) * 100)}
    >
      <span style={{ transform: `scaleX(${fraction})`, background: tint }} />
    </div>
  )
}

/** ContentUnavailableView: a centred icon, title, description and an optional action. */
export function ContentUnavailable({ icon: Icon, title, description, children, className = '' }) {
  return (
    <div className={`unavailable ${className}`}>
      {Icon && <Icon size={44} strokeWidth={1.6} className="unavailable__icon" aria-hidden />}
      <h2 className="t-title3 bold">{title}</h2>
      {description && <p className="t-subhead c-2">{description}</p>}
      {children && <div className="unavailable__actions">{children}</div>}
    </div>
  )
}

/** A capsule that floats up from the bottom for a moment, like the iOS "Saved" flash. The parent clears `message` in `onDone`. */
export function Flash({ message, icon: Icon, tone = 'positive', duration = 1400, onDone }) {
  useEffect(() => {
    if (!message) return undefined
    const t = setTimeout(() => onDone?.(), duration)
    return () => clearTimeout(t)
  }, [message, duration, onDone])
  if (!message) return null
  return (
    <div className={`flash glass-strong flash--${tone}`} role="status">
      {Icon && <Icon size={16} strokeWidth={2.4} aria-hidden />}
      {message}
    </div>
  )
}
