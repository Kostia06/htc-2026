import { useCallback, useEffect, useRef, useState } from 'react'
import { captionReducer, captionText, captionTicking, initialCaption } from './captionTrack.js'

const TICK_MS = 200

// Feeds voice events into the caption state machine and re-renders only when
// the visible line changes (while the interviewer speaks, a short interval
// steps through the pieces of the reply).
export function useCaptionTrack() {
  const stateRef = useRef(initialCaption)
  const [text, setText] = useState('')
  const [ticking, setTicking] = useState(false)

  const refresh = useCallback(() => {
    const now = Date.now()
    setText(captionText(stateRef.current, now))
    setTicking(captionTicking(stateRef.current, now))
  }, [])

  const dispatch = useCallback(
    (event) => {
      stateRef.current = captionReducer(stateRef.current, { now: Date.now(), ...event })
      refresh()
    },
    [refresh],
  )

  useEffect(() => {
    if (!ticking) return undefined
    const timer = setInterval(refresh, TICK_MS)
    return () => clearInterval(timer)
  }, [ticking, refresh])

  return { text, dispatch }
}
