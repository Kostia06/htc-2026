import { describe, expect, it } from 'vitest'
import { CLIP_CAP_SEC, clipEnd, clock, recordingNote, reviewRows } from './moments.js'

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

describe('clip ends', () => {
  const transcript = [
    { t: 7, speaker: 'agent', text: 'Tell me about yourself.' },
    { t: 10, speaker: 'person', text: 'I build things.' },
    { t: 24, speaker: 'agent', text: 'Nice. What went wrong?' },
  ]

  it('stops when the interviewer replies, not at the question being asked', () => {
    expect(clipEnd(8.5, { transcript })).toBe(24)
  })

  it('falls back to the next moment, then to the cap', () => {
    expect(clipEnd(30, { transcript, nextT: 41 })).toBe(41)
    expect(clipEnd(30, { transcript })).toBe(30 + CLIP_CAP_SEC)
    expect(clipEnd(0, { transcript: [{ t: 100, speaker: 'agent', text: 'x' }] })).toBe(CLIP_CAP_SEC)
  })

  it('never runs past the end of the call, and is never shorter than a few seconds', () => {
    expect(clipEnd(110, { durationSec: 120 })).toBe(120)
    expect(clipEnd(30, { nextT: 30.5 })).toBe(33)
  })

  it('gives each row its end', () => {
    const rows = reviewRows({ ...replay, transcript })
    expect(rows.map((r) => r.end)).toEqual([24, 62.5 + CLIP_CAP_SEC])
    expect(reviewRows({ ...replay, timing: 'order' }).every((r) => r.end === null)).toBe(true)
  })
})
