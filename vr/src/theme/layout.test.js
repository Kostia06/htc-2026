import { describe, expect, it } from 'vitest'
import { guessHeight, paginate, stack } from './layout.js'

describe('panel layout', () => {
  it('stacks blocks by their measured heights', () => {
    const { tops, total } = stack([0.05, 0.1, 0.02], 0.01)
    ;[0, 0.06, 0.17].forEach((t, i) => expect(tops[i]).toBeCloseTo(t))
    expect(total).toBeCloseTo(0.19)
    expect(stack([])).toEqual({ tops: [], total: 0 })
  })

  it('pages at most four rows', () => {
    expect(paginate([1, 2, 3, 4, 5, 6])).toEqual([[1, 2, 3, 4], [5, 6]])
    expect(paginate([])).toEqual([])
  })

  it('guesses at least one line', () => {
    expect(guessHeight('', 0.03, 0.5)).toBeCloseTo(0.03 * 1.28)
    expect(guessHeight('x'.repeat(100), 0.03, 0.5)).toBeGreaterThan(0.03 * 1.28 * 3)
  })
})
