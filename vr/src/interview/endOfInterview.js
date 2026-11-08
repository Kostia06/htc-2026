// The end of an interview, kept out of the hook so the flow can be tested
// without rendering one.

// What the summary card shows when no report came back: the room must still
// end on a card with a way out, never on an empty stage.
export const UNSCORED = Object.freeze({ unscored: true })

/**
 * The report for an interview that just ended, however it ended.
 *
 * Waits for the scores still in flight (the server only counts a turn once it
 * is scored), then always asks for the report. A missing or failed report is
 * UNSCORED, never an exception. `isCurrent()` turns false once the candidate
 * has gone back to the menu; a report landing after that answers null so it
 * cannot reappear over a fresh room.
 */
export async function reportAfterCall({ pending = [], finish, closingLine, isCurrent = () => true }) {
  await Promise.allSettled(pending)
  if (!isCurrent()) return null
  let report = null
  try {
    report = await finish({ closingLine })
  } catch (err) {
    console.warn('interview report failed', err)
  }
  if (!isCurrent()) return null
  return report ?? UNSCORED
}
