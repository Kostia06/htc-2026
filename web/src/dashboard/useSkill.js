import { useCallback, useEffect, useRef, useState } from 'react'
import { runSkill } from '../lib/agent'

// Agent runs take a while and cost a model call, so each result is kept on this device until the answers change.
// The stamp is when onboarding was finished: redoing it gives every panel a fresh start.
const prefix = (userId) => `raven-ai:${userId}:`
const cacheKey = (userId, stamp, key) => `${prefix(userId)}${stamp}:${key}`

function read(k) {
  try {
    return JSON.parse(localStorage.getItem(k) ?? 'null')
  } catch {
    return null
  }
}

function write(k, value) {
  try {
    localStorage.setItem(k, JSON.stringify(value))
  } catch {
    // private mode or full storage: the result still shows, it just isn't kept
  }
}

/** Drops results saved for an earlier set of answers. */
export function pruneResults(userId, stamp) {
  try {
    const keep = `${prefix(userId)}${stamp}:`
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(prefix(userId)) && !k.startsWith(keep)) localStorage.removeItem(k)
    }
  } catch {
    // nothing to prune
  }
}

/**
 * One agent skill's state: { status: 'idle' | 'loading' | 'done' | 'error', output, error, at }.
 * With `auto`, it runs once on mount when nothing is saved yet.
 */
export function useSkill({ userId, stamp, key, skill, auto = false }) {
  const k = cacheKey(userId, stamp, key)
  const [state, setState] = useState(() => {
    const saved = read(k)
    return saved ? { status: 'done', ...saved } : { status: 'idle' }
  })
  const running = useRef(false)

  const run = useCallback(
    async (input = {}) => {
      if (running.current) return
      running.current = true
      setState((s) => ({ ...s, status: 'loading', error: null }))
      try {
        const output = await runSkill(skill, input)
        const saved = { output, input, at: new Date().toISOString() }
        write(k, saved)
        setState({ status: 'done', ...saved })
      } catch (e) {
        setState((s) => ({ ...s, status: 'error', error: e }))
      } finally {
        running.current = false
      }
    },
    [k, skill],
  )

  const started = useRef(false)
  useEffect(() => {
    if (!auto || started.current || state.status !== 'idle') return
    started.current = true
    run(typeof auto === 'object' ? auto : {})
  }, [auto, run, state.status])

  return [state, run]
}
