// DetailSheet.swift and the app's other sheets. On a phone it rises from the bottom and drags down to close;
// on a wide screen it is a centred glass panel. The footer stays pinned below the scrolling content.
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

const CLOSE_MS = 220

/**
 * `header` gives the sheet an iOS navigation bar: { title, leading, trailing } (leading defaults to a Close button).
 * Without it the sheet shows only the drag indicator, like DetailSheet.
 */
export function Sheet({ onClose, header, footer, children, label, size = 'detail', className = '' }) {
  const [closing, setClosing] = useState(false)
  const panel = useRef(null)
  const drag = useRef(null)

  const requestClose = useCallback(() => {
    setClosing(true)
    setTimeout(onClose, CLOSE_MS)
  }, [onClose])

  useEffect(() => {
    const before = document.activeElement
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    panel.current?.focus({ preventScroll: true })
    const onKey = (e) => {
      if (e.key === 'Escape') requestClose()
      if (e.key === 'Tab') trapFocus(e, panel.current)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      before?.focus?.({ preventScroll: true })
    }
  }, [requestClose])

  // drag the grabber down to close, as on iOS
  const onPointerDown = (e) => {
    drag.current = { y: e.clientY, dy: 0 }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e) => {
    if (!drag.current || !panel.current) return
    drag.current.dy = Math.max(0, e.clientY - drag.current.y)
    panel.current.style.transform = `translateY(${drag.current.dy}px)`
    panel.current.style.transition = 'none'
  }
  const onPointerUp = () => {
    if (!drag.current || !panel.current) return
    const { dy } = drag.current
    drag.current = null
    panel.current.style.transition = ''
    panel.current.style.transform = ''
    if (dy > 110) requestClose()
  }

  const title = header?.title
  return createPortal(
    <div className={`sheet-layer${closing ? ' is-closing' : ''}`}>
      <div className="sheet-backdrop" onClick={requestClose} aria-hidden />
      <div
        ref={panel}
        className={`sheet glass-strong sheet--${size} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={label ?? (typeof title === 'string' ? title : undefined)}
        tabIndex={-1}
      >
        <div className="sheet__grabber" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          <span />
        </div>
        {header ? (
          <div className="sheet__bar">
            <div className="sheet__bar-side">
              {header.leading === undefined ? (
                <button type="button" className="glass-button sheet__close" onClick={requestClose} aria-label="Close">
                  <X size={18} strokeWidth={2.4} aria-hidden />
                </button>
              ) : (
                header.leading?.(requestClose)
              )}
            </div>
            <h2 className="t-headline sheet__title">{title}</h2>
            <div className="sheet__bar-side sheet__bar-side--end">{header.trailing?.(requestClose)}</div>
          </div>
        ) : (
          <button type="button" className="sheet__corner-close glass-button" onClick={requestClose} aria-label="Close">
            <X size={18} strokeWidth={2.4} aria-hidden />
          </button>
        )}
        <div className="sheet__body">{typeof children === 'function' ? children(requestClose) : children}</div>
        {footer && <div className="sheet__footer">{typeof footer === 'function' ? footer(requestClose) : footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

function trapFocus(e, root) {
  if (!root) return
  const items = [...root.querySelectorAll('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')].filter(
    (el) => !el.disabled && el.offsetParent !== null,
  )
  if (!items.length) return
  const first = items[0]
  const last = items[items.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}

/** A small confirmation, like iOS's confirmationDialog: a title, a message and one destructive action. */
export function Confirm({ title, message, confirmLabel, destructive = true, onConfirm, onClose }) {
  return (
    <Sheet onClose={onClose} size="confirm" label={title}>
      {(close) => (
        <div className="confirm">
          <h2 className="t-headline">{title}</h2>
          {message && <p className="t-subhead c-2">{message}</p>}
          <div className="confirm__actions">
            <button
              type="button"
              className={`confirm__btn${destructive ? ' is-destructive' : ''}`}
              onClick={() => {
                onConfirm()
                close()
              }}
            >
              {confirmLabel}
            </button>
            <button type="button" className="confirm__btn" onClick={close}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
