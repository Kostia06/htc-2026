// The pure parts of a replay, mirroring SessionReplay.swift: clock labels, the current line, what a screen reader hears.
import { AudioWaveform, Check, CircleAlert, MessageSquareQuote } from 'lucide-react'

export const KINDS = {
  mistake: { label: 'Mistake', icon: CircleAlert, color: 'var(--negative)' },
  better: { label: 'Better phrasing', icon: MessageSquareQuote, color: 'var(--agent)' },
  strength: { label: 'Strength', icon: Check, color: 'var(--positive)' },
  filler: { label: 'Filler words', icon: AudioWaveform, color: 'var(--text-2)' },
}

/** "0:07", "12:30" */
export function clock(seconds) {
  const whole = Math.max(0, Math.floor(seconds || 0))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/** The line being spoken at `time`: the last one that started at or before it. */
export function lineIndex(transcript, time) {
  let found = -1
  transcript.forEach((line, i) => {
    if (line.t <= time) found = i
  })
  return found
}

export const momentId = (m) => `${m.kind}-${m.turn}-${m.t}`

/** "1:42" for a recording, "Question 2" when only the order of answers is known. */
export const when = (replay, m) => (replay.timing === 'seconds' ? clock(m.t) : `Question ${m.turn + 1}`)

/** "Mistake at 1:42: Stayed too general" */
export function spokenLabel(replay, m) {
  const place = replay.timing === 'seconds' ? `at ${clock(m.t)}` : `on question ${m.turn + 1}`
  return `${KINDS[m.kind]?.label ?? 'Moment'} ${place}: ${m.title}`
}

/**
 * Where each dot sits along the bar, in percent. A mistake and its better phrasing often land a second apart,
 * so neighbours are kept a dot apart and neither hides the other.
 */
export function dotPositions(moments, duration, minGap = 2.5) {
  const positions = new Map()
  let last = -Infinity
  for (const m of [...moments].sort((a, b) => a.t - b.t)) {
    const at = Math.min(100, Math.max(duration > 0 ? (m.t / duration) * 100 : 0, last + minGap))
    positions.set(momentId(m), at)
    last = at
  }
  return positions
}
