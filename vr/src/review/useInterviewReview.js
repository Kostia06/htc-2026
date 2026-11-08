import { useEffect, useRef } from 'react'
import { useReview } from './useReview.js'

// The review panel's lifecycle around the interview: a finished interview opens its own review once the report is
// in, a phone launch can open any past one, and starting a new interview or going back to the menu from the
// summary puts the review away.
export function useInterviewReview(interview, headset) {
  const review = useReview({ token: headset.token, onSignedOut: headset.signOut })
  const { open, close } = review
  const { phase, summary, sessionId, isStub } = interview
  const wasDone = useRef(false)

  useEffect(() => {
    // an unscored interview has no report, so nothing to replay against
    if (phase === 'done' && summary && !summary.unscored && sessionId && !isStub) open(sessionId)
  }, [phase, summary, sessionId, isStub, open])

  useEffect(() => {
    if (phase === 'asking' || phase === 'listening') close()
    // "Back to menu" / "Practice again" is a clean room; a phone launch on the menu still opens its own
    if (phase === 'idle' && wasDone.current) close()
    wasDone.current = phase === 'done'
  }, [phase, close])

  return review
}
