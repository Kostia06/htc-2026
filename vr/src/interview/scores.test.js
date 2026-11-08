import { describe, expect, it } from 'vitest'
import { toHundred, toPanelScore, toPanelSummary } from './scores.js'

describe('toHundred', () => {
  it('maps the 1-5 rating onto 0-100 with the lowest at 0', () => {
    expect([1, 2, 3, 4, 5].map(toHundred)).toEqual([0, 25, 50, 75, 100])
  })

  it('clamps ratings outside 1-5', () => {
    expect(toHundred(0)).toBe(0)
    expect(toHundred(7)).toBe(100)
  })
})

describe('toPanelScore', () => {
  it('flattens a turn score and puts every dimension out of 100', () => {
    const panel = toPanelScore({
      scores: { structure: 4, relevance: 3.5, specificity: 2, confidence: 5 },
      delivery: { wordsPerMinute: 140, fillerWords: 2 },
      tip: 'Close with a number.',
    })
    expect(panel).toEqual({ structure: 75, relevance: 63, specificity: 25, confidence: 100, wpm: 140, fillerWords: 2, tip: 'Close with a number.' })
  })

  it('keeps going on an empty score', () => {
    expect(toPanelScore({ scores: {}, delivery: {}, tip: '' })).toEqual({ wpm: 0, fillerWords: 0, tip: '' })
  })
})

describe('toPanelSummary', () => {
  it('reads the debrief overall as is, already out of 100', () => {
    const summary = toPanelSummary({ overall: 72, verdict: 'Solid session.', nextSteps: ['Add numbers.', 'Slow down.'] })
    expect(summary).toEqual({ overall: 72, summary: 'Solid session. Add numbers.' })
  })

  it('takes the example summary as written', () => {
    expect(toPanelSummary({ overall: 60, summary: 'Your structure is solid.' })).toEqual({ overall: 60, summary: 'Your structure is solid.' })
  })
})
