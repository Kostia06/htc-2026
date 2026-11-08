import { useEffect } from 'react'
import { useReview } from './useReview.js'

// The review panel's lifecycle around the interview: a finished interview opens its own review once the report is
// in, a phone launch can open any past one, and starting a new interview puts the review away.
export function useInterviewReview(interview, headset) {
  const review = useReview({ token: headset.token, onSignedOut: headset.signOut })
  const { open, close } = review
  const { phase, summary, sessionId, isStub } = interview

  useEffect(() => {
    if (phase === 'done' && summary && sessionId && !isStub) open(sessionId)
  }, [phase, summary, sessionId, isStub, open])

  useEffect(() => {
    if (phase === 'asking' || phase === 'listening') close()
  }, [phase, close])

  return review
}
