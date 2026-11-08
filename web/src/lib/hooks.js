import { useEffect, useRef } from 'react'

/** Keeps a chat scrolled to its newest line. */
export function useStickToBottom(dependency) {
  const end = useRef(null)
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [dependency])
  return end
}

/** Calls `fn` every `ms` while `active` (and once at the start when `immediate`); the latest `fn` is always the one called. */
export function useInterval(fn, ms, active = true, immediate = false) {
  const saved = useRef(fn)
  useEffect(() => {
    saved.current = fn
  })
  useEffect(() => {
    if (!active) return undefined
    if (immediate) saved.current()
    const t = setInterval(() => saved.current(), ms)
    return () => clearInterval(t)
  }, [ms, active, immediate])
}

// A quick update saved something (a skill, a job, a step): every mounted screen showing that data refetches,
// like AppModel.updatesApplied on iOS, so nothing needs a reload to show it
const UPDATES_APPLIED = 'skillit:updates-applied'

export function announceUpdatesApplied(changes) {
  window.dispatchEvent(new CustomEvent(UPDATES_APPLIED, { detail: changes }))
}

export function useOnUpdatesApplied(fn) {
  const latest = useRef(fn)
  useEffect(() => {
    latest.current = fn
  })
  useEffect(() => {
    const run = (e) => latest.current(e.detail ?? [])
    window.addEventListener(UPDATES_APPLIED, run)
    return () => window.removeEventListener(UPDATES_APPLIED, run)
  }, [])
}
