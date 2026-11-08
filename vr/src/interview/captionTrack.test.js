import { describe, expect, it } from 'vitest'
import { captionReducer, captionText, chunkAt, chunkCaption, initialCaption, SPEECH_GAP_MS } from './captionTrack.js'

const run = (events) => events.reduce(captionReducer, initialCaption)

describe('chunkCaption', () => {
  it('splits a long line into short pieces at sentence ends', () => {
    expect(chunkCaption('Thanks for that. Now tell me about a time you led a team through a hard change.')).toEqual([
      'Thanks for that.',
      'Now tell me about a time you',
      'led a team through a hard change.',
    ])
  })

  it('returns nothing for empty text', () => {
    expect(chunkCaption('')).toEqual([])
    expect(chunkAt([], 1000)).toBe('')
  })

  it('advances through the pieces with time and holds the last one', () => {
    const chunks = ['Thanks for that.', 'Now tell me more.']
    expect(chunkAt(chunks, 0)).toBe('Thanks for that.')
    expect(chunkAt(chunks, 1500)).toBe('Now tell me more.')
    expect(chunkAt(chunks, 60_000)).toBe('Now tell me more.')
  })
})

describe('captionReducer', () => {
  it('shows the candidate line with "You:" during their turn', () => {
    const state = run([{ type: 'userText', text: 'I led the migration', now: 10 }])
    expect(captionText(state, 20)).toBe('You: I led the migration')
  })

  it('clears the candidate line the moment the interviewer starts', () => {
    const state = run([
      { type: 'userText', text: 'I led the migration', now: 0 },
      { type: 'speaking', speaking: true, now: 100 },
      { type: 'agentText', text: 'Great, thanks. What went wrong there?', now: 120 },
    ])
    expect(captionText(state, 150)).toBe('Great, thanks.')
    expect(captionText(state, 150)).not.toContain('You:')
  })

  it('ignores a late transcript that lands while the interviewer speaks', () => {
    const state = run([
      { type: 'agentText', text: 'Great, thanks. What went wrong there?', now: 0 },
      { type: 'speaking', speaking: true, now: 50 },
      { type: 'userText', text: 'I led the migration', now: 100 },
    ])
    expect(captionText(state, 200)).toBe('Great, thanks.')
  })

  it('times pieces from when the audio starts, even if text came first', () => {
    const state = run([
      { type: 'agentText', text: 'Thanks for that. Now tell me more.', now: 0 },
      { type: 'speaking', speaking: true, now: 5000 },
    ])
    expect(captionText(state, 5100)).toBe('Thanks for that.')
    expect(captionText(state, 6600)).toBe('Now tell me more.')
  })

  it('clears the line once the interviewer stops', () => {
    const state = run([
      { type: 'speaking', speaking: true, now: 0 },
      { type: 'agentText', text: 'Tell me about yourself.', now: 10 },
      { type: 'speaking', speaking: false, now: 2000 },
    ])
    expect(captionText(state, 2000 + SPEECH_GAP_MS + 1)).toBe('')
  })

  it('treats a short audio underrun as the same reply', () => {
    const state = run([
      { type: 'speaking', speaking: true, now: 0 },
      { type: 'agentText', text: 'Thanks for that. Now tell me more.', now: 10 },
      { type: 'speaking', speaking: false, now: 1000 },
      { type: 'speaking', speaking: true, now: 1200 },
    ])
    expect(captionText(state, 1500)).toBe('Now tell me more.')
  })

  it('never shows the previous reply when the next one starts', () => {
    const state = run([
      { type: 'speaking', speaking: true, now: 0 },
      { type: 'agentText', text: 'First question?', now: 10 },
      { type: 'speaking', speaking: false, now: 1000 },
      { type: 'userText', text: 'My answer', now: 3000 },
      { type: 'speaking', speaking: true, now: 5000 },
    ])
    expect(captionText(state, 5010)).toBe('')
    const next = captionReducer(state, { type: 'agentText', text: 'Second question?', now: 5020 })
    expect(captionText(next, 5030)).toBe('Second question?')
  })

  it('resets to an empty line', () => {
    const state = run([{ type: 'userText', text: 'hi', now: 0 }, { type: 'reset' }])
    expect(captionText(state, 10)).toBe('')
  })
})
