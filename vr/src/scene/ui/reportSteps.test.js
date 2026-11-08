import { describe, expect, it } from 'vitest'
import { nextLabel, reportSteps } from './reportSteps.js'

const scored = { status: 'scored', overall: 72, nextSteps: ['a', 'b', 'c', 'd'] }

describe('report steps', () => {
  it('goes score, tips three to a page, then moments', () => {
    const steps = reportSteps(scored, { hasMoments: true })
    expect(steps.map((s) => s.kind)).toEqual(['score', 'tips', 'tips', 'moments'])
    expect(steps[1].items).toEqual(['a', 'b', 'c'])
    expect(steps[2]).toMatchObject({ items: ['d'], page: 1, pages: 2 })
  })

  it('skips steps with nothing to show', () => {
    expect(reportSteps({ ...scored, nextSteps: [] }).map((s) => s.kind)).toEqual(['score'])
    expect(reportSteps({ status: 'pending' })).toEqual([{ kind: 'notice' }])
    expect(reportSteps(null)).toEqual([{ kind: 'notice' }])
  })

  it('labels the forward key by where it goes', () => {
    const steps = reportSteps(scored, { hasMoments: true })
    expect(steps.map((_, i) => nextLabel(steps, i))).toEqual(['Top tips', 'More tips', 'Moments', 'Practice again'])
  })
})
