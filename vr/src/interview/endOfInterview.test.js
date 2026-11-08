import { describe, expect, it, vi } from 'vitest'
import { reportAfterCall, UNSCORED } from './endOfInterview.js'
import { toEndCard } from './scores.js'
import { createStubSession } from './session.js'
import { endNotice } from '../scene/ui/copy.js'

const debrief = { overall: 72, verdict: 'Clear stories, light on numbers.', nextSteps: ['Add a number.', 'Name your part.'] }

describe('end of an interview -> summary card -> back to the menu', () => {
  it('asks for the report even when no turn was scored on the device', async () => {
    const finish = vi.fn(async () => debrief)
    const report = await reportAfterCall({ pending: [], finish })
    expect(finish).toHaveBeenCalledOnce()
    expect(toEndCard(report)).toMatchObject({ status: 'scored', overall: 72, verdict: debrief.verdict, nextSteps: debrief.nextSteps })
  })

  it('waits for scores still in flight, including failed ones, before finishing', async () => {
    const order = []
    const late = new Promise((resolve) => setTimeout(() => resolve(order.push('scored')), 5))
    const failed = Promise.reject(new Error('lost'))
    await reportAfterCall({ pending: [late, failed], finish: async () => order.push('finished') })
    expect(order).toEqual(['scored', 'finished'])
  })

  it('passes the interviewer\'s last line along for a conduct ending', async () => {
    const finish = vi.fn(async () => debrief)
    await reportAfterCall({ finish, closingLine: "I'm going to end the interview here." })
    expect(finish).toHaveBeenCalledWith({ closingLine: "I'm going to end the interview here." })
  })

  it('shows "not enough answers" instead of an error or 0/100 when there is no report', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const failed = await reportAfterCall({ finish: async () => { throw new Error('nothing was said in this session yet') } })
    expect(failed).toBe(UNSCORED)
    expect(toEndCard(failed).status).toBe('unscored')
    // the real session's no-answer reply has words but no number
    expect(toEndCard({ summary: 'No answers were recorded.', prepList: [] }).status).toBe('unscored')
    expect(endNotice('unscored').title).toBe('Not enough answers to score')
  })

  it('shows a card while the report is on its way, never an empty stage', () => {
    expect(toEndCard(null).status).toBe('pending')
    expect(endNotice('pending').title).toMatch(/report/i)
  })

  it('drops a report that lands after the candidate went back to the menu', async () => {
    let run = 1
    let resolve
    const finish = () => new Promise((r) => (resolve = r))
    const landing = reportAfterCall({ finish, isCurrent: () => run === 1 })
    await Promise.resolve()
    run = 2 // restart
    resolve(debrief)
    expect(await landing).toBeNull()
  })

  it('scores the example interview end to end', async () => {
    const session = createStubSession()
    await session.start()
    await session.submitAnswer({ question: 'Q', answer: 'I shipped it to 2,000 people.', durationMs: 4000 })
    const card = toEndCard(await reportAfterCall({ finish: (options) => session.finish(options) }))
    expect(card.status).toBe('scored')
    expect(Number.isFinite(card.overall)).toBe(true)
  })
})
