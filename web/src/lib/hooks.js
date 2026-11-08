import { useEffect, useRef } from 'react'

/** Keeps a chat scrolled to its newest line. */
export function useStickToBottom(dependency) {
  const end = useRef(null)
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [dependency])
  return end
}

/** Calls `fn` every `ms` while `active`; the latest `fn` is always the one called. */
export function useInterval(fn, ms, active = true) {
  const saved = useRef(fn)
  useEffect(() => {
    saved.current = fn
  })
  useEffect(() => {
    if (!active) return undefined
    const t = setInterval(() => saved.current(), ms)
    return () => clearInterval(t)
  }, [ms, active])
}
