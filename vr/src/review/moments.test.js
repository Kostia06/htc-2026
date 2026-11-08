import { describe, expect, it } from 'vitest'
import { clock, recordingNote, reviewRows } from './moments.js'

const replay = {
  audioUrl: '/api/voice/sessions/s1/replay/audio',
  recording: 'ready',
  timing: 'seconds',
  durationSec: 120,
  moments: [
    { t: 62.5, kind: 'delivery', title: '"We" 4 times, "I" 0', detail: 'Say what you did.', question: 'Q2', turn: 1 },
    {
      t: 8.5,
      kind: 'researched',
      title: 'How their interviewers hear it',
      detail: 'Acme hires for ownership.',
      better: 'I owned it.',
      question: 'Q1',
      turn: 0,
      sources: [{ title: 'Values', url: 'https://www.acme.com/values' }],
    },
  ],
  transcript: [],
}

describe('review rows', () => {
  it('lists moments in time order with a clock, a colour and the source hosts', () => {
    const rows = reviewRows(replay)
    expect(rows.map((r) => r.when)).toEqual(['0:08', '1:02'])
    expect(rows[0]).toMatchObject({ researched: true, sources: ['acme.com'], canPlay: true, t: 8.5, tone: 'blue' })
    expect(rows[1]).toMatchObject({ researched: false, sources: [], tone: 'orange' })
  })

  it('cannot play before the recording is ready, or when moments are only in answer order', () => {
    expect(reviewRows({ ...replay, audioUrl: null, recording: 'processing' }).every((r) => !r.canPlay)).toBe(true)
    const ordered = reviewRows({ ...replay, timing: 'order', audioUrl: null })
    expect(ordered.map((r) => r.when)).toEqual(['Question 1', 'Question 2'])
    expect(recordingNote({ ...replay, recording: 'processing', audioUrl: null })).toMatch(/still being prepared/)
  })

  it('reads clock labels the way the phone does', () => {
    expect(clock(7)).toBe('0:07')
    expect(clock(750)).toBe('12:30')
    expect(reviewRows(null)).toEqual([])
  })
})
