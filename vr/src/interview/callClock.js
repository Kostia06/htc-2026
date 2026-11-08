// Seconds since the call connected, for stamping each answer live so the replay can seek straight to it.
// The same rule as TranscriptTurns.swift and web/src/lib/voice.js: an answer starts when the agent stops talking,
// because the transcript line only arrives once the person has finished saying it.
export function createCallClock(now = () => performance.now()) {
  let startedAt = null
  let floorAt = null

  return {
    // only the first connect counts: a reconnect must not shift every later timestamp
    started() {
      startedAt ??= now()
    },
    floorOpened() {
      floorAt = now()
    },
    /** { answerStartSec, atSec } for the answer that just closed, or {} before the call has connected. */
    stamp() {
      if (startedAt === null) return {}
      const at = now()
      const seconds = (time) => Math.max(0, (time - startedAt) / 1000)
      const stamp = { answerStartSec: seconds(floorAt ?? at), atSec: seconds(at) }
      floorAt = null
      return stamp
    },
    reset() {
      startedAt = null
      floorAt = null
    },
  }
}
