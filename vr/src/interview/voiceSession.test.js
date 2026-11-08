import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createVoiceSession, toAnswerScore, toSummary } from './voiceSession.js'

const reply = (body, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) })

describe('createVoiceSession', () => {
  let fetchMock
  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('starts from the launch, walks the plan, scores turns and debriefs', async () => {
    fetchMock
      .mockReturnValueOnce(
        reply({
          sessionId: 's1',
          opening: 'Hi, thanks for coming in.',
          questions: [{ text: 'Tell me about ATB.', reported: true }, { text: 'Why data?' }],
        }, 201),
      )
      .mockReturnValueOnce(
        reply({ scores: { structure: 4, relevance: 3, specificity: 2, confidence: 5 }, delivery: { wordsPerMinute: 150, fillerWords: 2 }, tip: 'Add a number.' }),
      )
      .mockReturnValueOnce(reply({ overall: 70, verdict: 'Solid.', nextSteps: ['Practise STAR.', 'Slow down.', 'ignored'] }))

    const signedOut = vi.fn()
    const session = createVoiceSession({ getToken: () => 'tok', baseUrl: 'https://api', onSignedOut: signedOut })

    const meta = await session.start({ companySlug: 'atb', role: 'Junior data analyst' })
    expect(meta).toMatchObject({ company: 'ATB', role: 'Junior data analyst', questionCount: 2, opening: 'Hi, thanks for coming in.' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api/api/voice/sessions')
    expect(init.headers.authorization).toBe('Bearer tok')
    expect(JSON.parse(init.body)).toEqual({ mode: 'interview', companySlug: 'atb', role: 'Junior data analyst' })

    const first = await session.nextQuestion()
    expect(first).toEqual({ id: 'q0', text: 'Tell me about ATB.', isSeeded: false })
    expect((await session.nextQuestion()).isSeeded).toBe(true)
    expect(await session.nextQuestion()).toBeNull()

    const scored = await session.submitAnswer({ question: first.text, transcript: ' I built a thing. ', durationMs: 4200.6 })
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ question: first.text, answer: 'I built a thing.', durationMs: 4201 })
    expect(scored).toMatchObject({ structure: 4, specificity: 2, wpm: 150, fillerWords: 2, tip: 'Add a number.' })
    expect(scored.dimensions).toEqual(['structure', 'relevance', 'specificity', 'confidence'])

    expect(await session.finish()).toEqual({ overall: 3.5, summary: 'Solid. Practise STAR. Slow down.' })
    expect(fetchMock.mock.calls[2][0]).toBe('https://api/api/voice/sessions/s1/finish')
    expect(signedOut).not.toHaveBeenCalled()
  })

  it('refuses to score silence without a network call', async () => {
    fetchMock.mockReturnValueOnce(reply({ sessionId: 's1', questions: [] }, 201))
    const session = createVoiceSession({ getToken: () => 'tok', baseUrl: 'https://api' })
    await session.start()
    await expect(session.submitAnswer({ question: 'q', transcript: '   ' })).rejects.toThrow(/Nothing was heard/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(await session.finish()).toEqual({ overall: 0, summary: 'No answers recorded.' })
  })

  it('signs the headset out on a 401', async () => {
    fetchMock.mockReturnValueOnce(reply({ error: 'nope' }, 401))
    const signedOut = vi.fn()
    const session = createVoiceSession({ getToken: () => 'stale', baseUrl: 'https://api', onSignedOut: signedOut })
    await expect(session.start()).rejects.toThrow(/sign in again/)
    expect(signedOut).toHaveBeenCalledOnce()
  })

  it('surfaces the server message on other failures', async () => {
    fetchMock.mockReturnValueOnce(reply({ error: 'unknown company' }, 404))
    const session = createVoiceSession({ getToken: () => 'tok', baseUrl: 'https://api' })
    await expect(session.start({ companySlug: 'nope' })).rejects.toThrow('unknown company')
  })
})

describe('mappers', () => {
  it('fills missing scores with zero and keeps the transcript', () => {
    expect(toAnswerScore({ tip: 'x' }, 'said')).toMatchObject({ structure: 0, confidence: 0, wpm: 0, fillerWords: 0, tip: 'x', transcript: 'said' })
  })

  it('turns a 0-100 debrief into the panel scale', () => {
    expect(toSummary({ overall: 100, verdict: 'Great.' })).toEqual({ overall: 5, summary: 'Great.' })
    expect(toSummary({})).toEqual({ overall: 0, summary: 'Interview complete.' })
  })
})
