// Small controls that mirror the iOS ones: section chips, the segmented picker, fact grid, expandable text, option tiles.
import { useId, useState } from 'react'

/** SectionChips.swift: a horizontal row of capsules; the selected one is sage. */
export function ChipBar({ items, value, onChange, label }) {
  return (
    <div className="chipbar" role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={item.id === value}
          className={`chipbar__chip${item.id === value ? ' is-selected' : ''}`}
          onClick={() => onChange(item.id)}
        >
          {item.title}
        </button>
      ))}
    </div>
  )
}

/** The iOS segmented Picker. */
export function Segmented({ options, value, onChange, label }) {
  const index = Math.max(0, options.findIndex((o) => o.id === value))
  return (
    <div className="segmented" role="radiogroup" aria-label={label} style={{ '--count': options.length, '--index': index }}>
      <span className="segmented__thumb" aria-hidden />
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={o.id === value}
          className={o.id === value ? 'is-selected' : undefined}
          onClick={() => onChange(o.id)}
        >
          {o.title}
        </button>
      ))}
    </div>
  )
}

/** FactGrid: two columns of small label over value. Empty values are left out. */
export function FactGrid({ facts }) {
  const shown = facts.filter((f) => f.value)
  if (!shown.length) return null
  return (
    <dl className="fact-grid">
      {shown.map((f) => (
        <div key={f.label}>
          <dt className="t-caption c-2">{f.label}</dt>
          <dd className="t-subhead semibold clamp-1" style={f.tint ? { color: f.tint } : undefined}>
            {f.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** ExpandableText: three lines, then More / Less when the text is long enough to need it. */
export function ExpandableText({ text, lines = 3, className = 't-body' }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const long = text.length > lines * 45
  return (
    <div className="expandable">
      <p id={id} className={`${className} expandable__text ${!open && long ? `clamp-${lines}` : ''}`}>
        {text}
      </p>
      {long && (
        <button type="button" className="expandable__toggle t-subhead semibold" aria-controls={id} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Less' : 'More'}
        </button>
      )}
    </div>
  )
}

/** OptionButtonStyle.swift: a tile with a 2px border and a 4px ledge in the same colour. */
export function OptionTile({ selected, children, className = '', ...props }) {
  return (
    <button type="button" className={`option-tile${selected ? ' is-selected' : ''} ${className}`} aria-pressed={selected} {...props}>
      <span className="option-tile__face">{children}</span>
    </button>
  )
}

/** A small capsule label on a card. */
export function Chip({ icon: Icon, children, className = '' }) {
  return (
    <span className={`chip t-caption ${className}`}>
      {Icon && <Icon size={12} strokeWidth={2.2} aria-hidden />}
      {children}
    </span>
  )
}
