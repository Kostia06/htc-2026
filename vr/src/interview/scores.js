// Server shapes -> what the score panels draw. Everything the person reads is
// out of 100, the same scale as the phone and the web report.

// The Worker rates each dimension 1-5. The lowest rating reads as 0, not 20:
// the same mapping the server uses when it builds the report.
export function toHundred(rating) {
  const clamped = Math.min(5, Math.max(1, rating))
  return Math.round(((clamped - 1) / 4) * 100)
}

// POST /turns answers { scores: { structure, ... }, delivery, tip }; the panel
// renders flat keys.
export function toPanelScore(score) {
  if (!score) return null
  const dimensions = Object.entries(score.scores ?? {}).filter(([, rating]) => Number.isFinite(rating))
  return {
    ...Object.fromEntries(dimensions.map(([dim, rating]) => [dim, toHundred(rating)])),
    wpm: score.delivery?.wordsPerMinute ?? 0,
    fillerWords: score.delivery?.fillerWords ?? 0,
    tip: score.tip,
  }
}

// POST /finish answers the debrief { overall: 0-100, verdict, nextSteps }.
export function toPanelSummary(debrief) {
  if (!debrief) return null
  const words = debrief.summary ?? [debrief.verdict, debrief.nextSteps?.[0]].filter(Boolean).join(' ')
  // verdict and next steps kept apart too: the summary card lays them out like
  // the phone's report (headline, then "Work on next" rows).
  return {
    overall: debrief.overall ?? 0,
    summary: words || 'Interview complete.',
    verdict: debrief.verdict ?? null,
    nextSteps: (debrief.nextSteps ?? []).filter(Boolean).slice(0, 3),
  }
}
