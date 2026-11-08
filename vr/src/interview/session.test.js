import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createStubSession } from './session.js'
import { EXAMPLE_QUESTIONS } from './questions.js'

const DIMENSIONS = ['structure', 'clarity', 'confidence', 'relevance']

const LONG_ANSWER =
  'We had four days to ship a payments integration in a language I had never written before. ' +
  'I spent the first morning reading the reference implementation, had a throwaway prototype by noon, ' +
  'then rewrote it properly with tests the next day. It shipped on day three and cleared about twelve ' +
  'hundred transactions in the first week with no rollbacks at all.'

const SHORT_ANSWER = 'Yeah, I did that once.'

// The stub fakes model latency on purpose. Fake timers let us keep that latency
// in the code under test without paying for it on every run.
const settle = async (promise) => {
  await vi.runAllTimersAsync()
  return promise
}

const totalScore = (score) => DIMENSIONS.reduce((sum, dim) => sum + score[dim], 0)

async function answer(transcript, durationMs) {
  const session = createStubSession()
  await settle(session.start())
  const question = await settle(session.nextQuestion())
  return settle(session.submitAnswer({ questionId: question.id, transcript, durationMs }))
}

describe('createStubSession', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('asks every question once in order, then returns null', async () => {
    const session = createStubSession({ company: 'Acme', role: 'Designer' })
    const meta = await settle(session.start())

    expect(meta).toEqual({
      company: 'Acme',
      role: 'Designer',
      questionCount: EXAMPLE_QUESTIONS.length,
      live: null,
    })

    const asked = []
    for (let i = 0; i < EXAMPLE_QUESTIONS.length + 2; i++) {
      asked.push(await settle(session.nextQuestion()))
    }

    expect(asked.slice(0, EXAMPLE_QUESTIONS.length).map((q) => q.id)).toEqual(
      EXAMPLE_QUESTIONS.map((q) => q.id),
    )
    expect(asked.slice(EXAMPLE_QUESTIONS.length)).toEqual([null, null])
  })

  // The privacy rules require an EXAMPLE badge on anything seeded. A question
  // leaving here unflagged would be rendered as a real reported question.
  it('flags every stub question as seeded', async () => {
    const session = createStubSession()
    expect(session.isStub).toBe(true)

    const { questionCount } = await settle(session.start())
    for (let i = 0; i < questionCount; i++) {
      const question = await settle(session.nextQuestion())
      expect(question.isSeeded, `${question.id} would be shown as a real report`).toBe(true)
    }

    expect(EXAMPLE_QUESTIONS.every((q) => q.isSeeded === true)).toBe(true)
  })

  it('returns the full AnswerScore contract', async () => {
    const score = await answer(LONG_ANSWER, 42000)

    for (const dim of DIMENSIONS) {
      expect(Number.isInteger(score[dim]), `${dim} is ${score[dim]}`).toBe(true)
      expect(score[dim]).toBeGreaterThanOrEqual(1)
      expect(score[dim]).toBeLessThanOrEqual(5)
    }
    expect(typeof score.fillerWords).toBe('number')
    expect(typeof score.wpm).toBe('number')
    expect(score.wpm).toBeGreaterThan(0)
    expect(score.strongerAnswer.length).toBeGreaterThan(0)
    expect(score.tip.length).toBeGreaterThan(0)
    expect(score.transcript).toBe(LONG_ANSWER)
  })

  it('scores a one-line answer below a substantial one', async () => {
    const short = await answer(SHORT_ANSWER, 4000)
    const full = await answer(LONG_ANSWER, 42000)

    expect(totalScore(short)).toBeLessThan(totalScore(full))
    expect(short.tip).not.toBe(full.tip)
  })

  it('finishes with an aggregate that matches the answers given', async () => {
    const session = createStubSession()
    await settle(session.start())

    const given = []
    for (const question of EXAMPLE_QUESTIONS) {
      await settle(session.nextQuestion())
      given.push(
        await settle(
          session.submitAnswer({
            questionId: question.id,
            transcript: LONG_ANSWER,
            durationMs: 40000,
          }),
        ),
      )
    }

    const { overall, summary } = await settle(session.finish())
    const expected =
      given.reduce((sum, score) => sum + totalScore(score) / DIMENSIONS.length, 0) / given.length
    const weakest = DIMENSIONS.map((dim) => ({
      dim,
      mean: given.reduce((sum, score) => sum + score[dim], 0) / given.length,
    })).sort((a, b) => a.mean - b.mean)[0]

    expect(overall).toBeCloseTo(expected, 1)
    expect(overall).toBeGreaterThanOrEqual(1)
    expect(overall).toBeLessThanOrEqual(5)
    expect(summary).toContain(weakest.dim)
  })

  it('resets on start, so a second run of the demo behaves like the first', async () => {
    const session = createStubSession()
    await settle(session.start())
    const first = await settle(session.nextQuestion())
    await settle(
      session.submitAnswer({ questionId: first.id, transcript: SHORT_ANSWER, durationMs: 4000 }),
    )

    await settle(session.start())

    expect((await settle(session.nextQuestion())).id).toBe(first.id)
    // Zero proves the previous run's scores were dropped, not carried over.
    expect((await settle(session.finish())).overall).toBe(0)
  })
})
