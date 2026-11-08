// RaisedButtonStyle.swift: the chunky button that sits on a darker ledge and sinks onto it when pressed.
const VARIANTS = {
  action: { face: 'var(--action)', fg: 'var(--on-action)' },
  secondary: { face: 'var(--secondary-button)', fg: '#fff' },
  agent: { face: 'var(--agent)', fg: 'var(--on-action)' },
  grey: { face: 'var(--grey-22)', fg: '#fff' },
  raised: { face: 'var(--raised)', fg: '#fff' },
  muted: { face: 'var(--grey-22)', fg: 'rgb(255 255 255 / 0.5)' },
}

/** `variant` picks the face colour; `busy` swaps the label for a spinner. */
export function RaisedButton({ variant = 'action', icon: Icon, busy = false, children, className = '', style, ...props }) {
  const v = VARIANTS[variant] ?? VARIANTS.action
  return (
    <button
      type="button"
      className={`raised-btn ${className}`}
      style={{ '--face': v.face, '--fg': v.fg, ...style }}
      aria-busy={busy || undefined}
      {...props}
    >
      <span className="raised-btn__face">
        {busy ? <Spinner /> : Icon ? <Icon size={19} strokeWidth={2.4} aria-hidden /> : null}
        {children}
      </span>
    </button>
  )
}

export function Spinner({ size = 18, className = '' }) {
  return <span className={`spinner ${className}`} style={{ width: size, height: size }} role="progressbar" aria-label="Loading" />
}

/** A plain text button, like SwiftUI's borderless buttons: secondary by default. */
export function TextButton({ tone = 'secondary', icon: Icon, children, className = '', ...props }) {
  return (
    <button type="button" className={`text-btn text-btn--${tone} ${className}`} {...props}>
      {Icon && <Icon size={17} strokeWidth={2.2} aria-hidden />}
      {children}
    </button>
  )
}
