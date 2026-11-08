import { describe, expect, it, vi } from 'vitest'
import { ANSWER_HINTS_KEY, createHintLoader, readHintsSetting, writeHintsSetting } from './useAnswerHints.js'

function memoryStorage() {
  const data = new Map()
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), data }
}

const QUESTION = 'Tell me about a time you fixed a broken process.'
const LATER = 'What would you do in your first ninety days here?'

describe('Hints switch', () => {
  it('is off until turned on, and remembers the choice', () => {
    const storage = memoryStorage()
    expect(readHintsSetting(storage)).toBe(false)
    writeHintsSetting(true, storage)
    expect(storage.data.get(ANSWER_HINTS_KEY)).toBe('on')
    expect(readHintsSetting(storage)).toBe(true)
    writeHintsSetting(false, storage)
    expect(readHintsSetting(storage)).toBe(false)
  })

  it('stays off when storage is blocked', () => {
    const blocked = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } }
    expect(readHintsSetting(blocked)).toBe(false)
    expect(() => writeHintsSetting(true, blocked)).not.toThrow()
  })
})

describe('hint loader', () => {
  it('asks once per question and reuses the answer', async () => {
    const fetchPoints = vi.fn(async () => ['Situation', 'Action', 'Result'])
    const onPoints = vi.fn()
    const loader = createHintLoader(fetchPoints, onPoints)
    await loader.show(QUESTION)
    await loader.show(QUESTION)
    expect(fetchPoints).toHaveBeenCalledTimes(1)
    expect(onPoints).toHaveBeenLastCalledWith(['Situation', 'Action', 'Result'])
  })

  it('never shows a late answer for a question that has moved on', async () => {
    let release
    const fetchPoints = vi.fn((q) => (q === QUESTION ? new Promise((r) => (release = () => r(['old']))) : Promise.resolve(['new'])))
    const onPoints = vi.fn()
    const loader = createHintLoader(fetchPoints, onPoints)
    const first = loader.show(QUESTION)
    await loader.show(LATER)
    release()
    await first
    expect(onPoints).toHaveBeenLastCalledWith(['new'])
  })

  it('skips filler lines and survives a failed request', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetchPoints = vi.fn(async () => {
      throw new Error('502')
    })
    const onPoints = vi.fn()
    const loader = createHintLoader(fetchPoints, onPoints)
    await loader.show('Are you still there?')
    expect(fetchPoints).not.toHaveBeenCalled()
    await loader.show(QUESTION)
    expect(onPoints).toHaveBeenLastCalledWith(null)
    warn.mockRestore()
  })
})
