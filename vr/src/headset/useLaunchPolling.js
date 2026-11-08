import { useEffect, useRef } from 'react'
import { SignedOutError, pollLaunch } from './api.js'

const RETRY_MS = 3000

// Long-polls GET /api/headset/launch while `enabled`, and hands each launch
// the phone queued ({ mode, companySlug?, role?, stepId? }) to `onLaunch`.
// Disable it while an interview is running so a stray tap on the phone cannot
// restart the one in progress.
export function useLaunchPolling(session, { enabled, onLaunch, onSignedOut }) {
  const handlers = useRef({ onLaunch, onSignedOut })
  handlers.current = { onLaunch, onSignedOut }

  useEffect(() => {
    if (!enabled || !session) return undefined
    const controller = new AbortController()
    let retry

    const poll = async () => {
      try {
        const launch = await pollLaunch(session, controller.signal)
        if (controller.signal.aborted) return
        if (launch) {
          // true means the room stays idle (a review opened), so keep listening for the next tap
          if (handlers.current.onLaunch(launch) === true) void poll()
          return // otherwise the caller flips `enabled` off; polling resumes when it is back on
        }
        void poll()
      } catch (error) {
        if (controller.signal.aborted) return
        if (error instanceof SignedOutError) return handlers.current.onSignedOut()
        retry = setTimeout(() => void poll(), RETRY_MS)
      }
    }
    void poll()

    return () => {
      controller.abort()
      clearTimeout(retry)
    }
  }, [session, enabled])
}
