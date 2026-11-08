// The pure side of the in-headset review, mirroring web/src/features/replay/replay.js: what each row shows.

// one dot colour per kind (keys of the panels' palette): the headset font has no icon glyphs to draw
export const KIND_TONE = {
  mistake: 'red',
  better: 'blue',
  researched: 'blue',
  strength: 'green',
  filler: 'grey',
  delivery: 'orange',
}

/** "0:07", "12:30" */
export function clock(seconds) {
  const whole = Math.max(0, Math.floor(seconds || 0))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * One row per moment, in time order. `canPlay` is false until the recording is ready, and for a session timed only
 * by answer order, where `t` isn't a second in any recording.
 */
export function reviewRows(replay) {
  if (!replay) return []
  const seconds = replay.timing === 'seconds'
  const playable = seconds && Boolean(replay.audioUrl)
  return [...replay.moments]
    .sort((a, b) => a.t - b.t)
    .map((m) => ({
      id: `${m.kind}-${m.turn}-${m.t}`,
      tone: KIND_TONE[m.kind] ?? KIND_TONE.delivery,
      kind: m.kind,
      title: m.title,
      detail: m.detail,
      better: m.better ?? null,
      when: seconds ? clock(m.t) : `Question ${m.turn + 1}`,
      t: m.t,
      canPlay: playable,
      researched: m.kind === 'researched',
      sources: (m.sources ?? []).map((s) => hostOf(s.url)),
    }))
}

/** What the panel says about the recording itself. */
export function recordingNote(replay) {
  if (!replay) return 'Loading the review…'
  if (replay.recording === 'processing') return 'The recording is still being prepared.'
  if (!replay.audioUrl) return 'No recording for this one, so these are the notes only.'
  return 'Point at a moment to play from there.'
}
