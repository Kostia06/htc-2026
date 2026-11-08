import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApiSession, createStubSession } from './session.js'
import { EXAMPLE_QUESTIONS } from './questions.js'
import { SignedOutError } from '../headset/api.js'
import { launchOf, targetsOf } from './picker.js'

const DIMENSIONS = ['structure', 'relevance', 'specificity', 'confidence']

// Hand-counted: 28 words, so it clears the stub's 25-word "thin answer" line.
const SOLID =
  'We had four days to ship the payments integration, so I read the reference code, ' +
  'built a prototype by noon, and shipped it with tests on day three.'
const THIN = 'Yeah, I did that once.'
const FILLERS = 'Um, I guess I like, you know, uh, just sort of handled it myself in the end.'

// The stub fakes model latency on purpose (650ms a turn). Fake timers keep that
// latency in the code under test without paying for it on every run. The promise
// is created before settle() runs, so its timer is already pending.
const settle = async (promise) => {
  await vi.runAllTimersAsync()
  return promise
}

async function answerOnce(args) {
  const session = createStubSession()
  await settle(session.start())
  return settle(session.submitAnswer({ question: 'q', ...args }))
}

describe('createStubSession', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('opens with a greeting and a first question', async () => {
    const session = createStubSession({ company: 'Acme', role: 'Designer' })
    expect(session.isStub).toBe(true)

    const { company, role, opening, question, isSeeded } = await settle(session.start())

    expect(company).toBe('Acme')
    expect(role).toBe('Designer')
    expect(typeof opening).toBe('string')
    expect(opening.trim().length).toBeGreaterThan(0)
    expect(typeof question).toBe('string')
    expect(question.trim().length).toBeGreaterThan(0)
    expect(question).not.toBe(opening)
    // Privacy rules: anything seeded has to arrive flagged or the panel renders
    // example data without its EXAMPLE badge.
    expect(isSeeded).toBe(true)
  })

  // The probe is what makes the interview feel real, and it is what the live
  // server does too, so the scene has to handle it from the stub as well.
  it('probes a thin answer with a follow-up', async () => {
    const { next } = await answerOnce({ answer: THIN, durationMs: 4000 })

    expect(next.kind).toBe('follow_up')
    expect(next.say.trim().length).toBeGreaterThan(0)
  })

  it('moves to a new question after a substantial answer', async () => {
    const session = createStubSession()
    const { question } = await settle(session.start())
    const { next } = await settle(
      session.submitAnswer({ question, answer: SOLID, durationMs: 12000 }),
    )

    expect(next.kind).toBe('question')
    expect(next.say).not.toBe(question)
  })

  it('reaches a wrap_up and stops asking', async () => {
    const session = createStubSession()
    let { question } = await settle(session.start())
    const asked = [question]
    let kind = null

    // Bounded: a state machine that never advances must fail the suite, not hang it.
    for (let turn = 0; turn < EXAMPLE_QUESTIONS.length + 4 && kind !== 'wrap_up'; turn++) {
      const { next } = await settle(
        session.submitAnswer({ question, answer: SOLID, durationMs: 12000 }),
      )
      kind = next.kind
      question = next.say
      asked.push(next.say)
    }

    expect(kind).toBe('wrap_up')
    expect(asked.length).toBeLessThanOrEqual(EXAMPLE_QUESTIONS.length + 1)
    expect(new Set(asked).size).toBe(asked.length) // no question repeated
  })

  it('returns the documented score shape', async () => {
    const { score } = await answerOnce({ answer: SOLID, durationMs: 12000 })

    expect(Object.keys(score.scores).sort()).toEqual([...DIMENSIONS].sort())
    for (const dim of DIMENSIONS) {
      expect(score.scores[dim], dim).toBeGreaterThanOrEqual(1)
      expect(score.scores[dim], dim).toBeLessThanOrEqual(5)
    }
    expect(score.delivery.words).toBe(28)
    expect(score.delivery.wordsPerMinute).toBe(140) // 28 words in 12s
    expect(typeof score.tip).toBe('string')
    expect(score.tip.trim().length).toBeGreaterThan(0)
  })

  it('counts um / uh / like / you know as filler words', async () => {
    const { score } = await answerOnce({ answer: FILLERS, durationMs: 9000 })

    expect(score.delivery.words).toBe(17)
    expect(score.delivery.fillerWords).toBe(4) // um, like, you know, uh
  })

  it('reports no words-per-minute when there are no words', async () => {
    const { score } = await answerOnce({ answer: '', durationMs: 5000 })

    expect(score.delivery.words).toBe(0)
    expect(score.delivery.wordsPerMinute).toBeNull()
  })

  // KNOWN GAP, reported not fixed: the contract says wordsPerMinute is null when
  // Without a duration there is no pace to report. Gating this on the word count
  // instead once put ~1680 wpm straight into the score panel.
  it('reports no words-per-minute when the answer was not timed', async () => {
    const { score } = await answerOnce({ answer: SOLID })

    expect(score.delivery.wordsPerMinute).toBeNull()
    expect(score.delivery.words).toBeGreaterThan(0)
  })

  it('scores a thin answer below a substantial one', async () => {
    // Fresh sessions: both land on the same question, so only answer length differs.
    const thin = await answerOnce({ answer: THIN, durationMs: 4000 })
    const solid = await answerOnce({ answer: SOLID, durationMs: 12000 })

    const lower = DIMENSIONS.filter((dim) => thin.score.scores[dim] < solid.score.scores[dim])
    expect(lower.length).toBeGreaterThan(0)
    expect(thin.score.tip).not.toBe(solid.score.tip)
  })

  it('resets on start, so a second run of the demo behaves like the first', async () => {
    const session = createStubSession()

    const first = await settle(session.start())
    const firstTurn = await settle(
      session.submitAnswer({ question: first.question, answer: SOLID, durationMs: 12000 }),
    )

    const again = await settle(session.start())
    const againTurn = await settle(
      session.submitAnswer({ question: again.question, answer: SOLID, durationMs: 12000 }),
    )

    expect(again.question).toBe(first.question)
    expect(againTurn.next).toEqual(firstTurn.next)
  })

  it('finishes with a summary and a prep list', async () => {
    const session = createStubSession()
    await settle(session.start())
    const { summary, prepList } = await settle(session.finish())

    expect(typeof summary).toBe('string')
    expect(summary.trim().length).toBeGreaterThan(0)
    expect(prepList.length).toBeGreaterThan(0)
    for (const item of prepList) {
      expect(Object.keys(item).sort()).toEqual(['step', 'why'])
      expect(item.step.trim().length).toBeGreaterThan(0)
      expect(item.why.trim().length).toBeGreaterThan(0)
    }
  })

  // Speech recognition is unreliable in the Quest browser, so these are the
  // answers the scene actually submits when a turn goes wrong.
  it.each([
    ['no answer at all', { answer: '', durationMs: 3000 }],
    ['whitespace only', { answer: '   \n\t  ', durationMs: 3000 }],
    ['no duration measured', { answer: SOLID }],
    ['a very long answer', { answer: 'word '.repeat(5000), durationMs: 600000 }],
  ])('survives %s', async (_label, args) => {
    const { score, next } = await answerOnce(args)

    for (const dim of DIMENSIONS) {
      expect(score.scores[dim], dim).toBeGreaterThanOrEqual(1)
      expect(score.scores[dim], dim).toBeLessThanOrEqual(5)
    }
    expect(score.delivery.words).toBeGreaterThanOrEqual(0)
    expect(['follow_up', 'question', 'wrap_up']).toContain(next.kind)
  })
})

// ─── createApiSession ────────────────────────────────────────────────────────
// No real requests: fetch is swapped for a recorder so we can assert on exactly
// what the seam puts on the wire.

const BASE = 'https://worker.test'
const TOKEN = 'tok_abc123'
const OPENING = 'Hi, thanks for making the time. Shall we start?'
const FIRST = 'Walk me through a project you shipped under a deadline.'
const SECOND = 'Tell me about a disagreement with a teammate.'

function recordingFetch() {
  const calls = []
  // Most specific path first: /turns and /next both sit under /api/voice/sessions.
  const routes = [
    ['/turns', { scores: { structure: 4.2, relevance: 3.8, specificity: 3.5, confidence: 4 }, delivery: { words: 28, fillerWords: 1, wordsPerMinute: 140 }, tip: 'Close with a number.' }],
    ['/next', { say: SECOND, kind: 'question' }],
    ['/finish', { summary: 'Solid structure.', prepList: [{ step: 'Add numbers', why: 'Verifiable' }] }],
    ['/conversation', { ok: true }],
    ['/hint', { points: ['Situation: the backlog', 'Result: [number] hours saved'] }],
    ['/api/voice/sessions', { sessionId: 'sess_1', companySlug: 'acme', opening: OPENING, questions: [{ text: FIRST }, { text: SECOND }] }],
  ]

  const fetch = vi.fn(async (url, init = {}) => {
    calls.push({
      url,
      method: init.method ?? 'GET',
      headers: init.headers ?? {},
      body: init.body ? JSON.parse(init.body) : null,
    })
    const route = routes.find(([path]) => url.endsWith(path))
    if (!route) throw new Error(`fake fetch has no route for ${url}`)
    return { ok: true, status: 200, json: async () => route[1] }
  })

  return { fetch, calls, of: (path) => calls.filter((c) => c.url.endsWith(path)) }
}

describe('createApiSession', () => {
  let api
  let realFetch

  beforeEach(() => {
    api = recordingFetch()
    realFetch = globalThis.fetch
    globalThis.fetch = api.fetch
  })

  afterEach(() => {
    globalThis.fetch = realFetch
  })

  // The token is the headset's, from the keypad sign-in.
  const session = (options = {}) =>
    createApiSession({ getToken: () => TOKEN, baseUrl: BASE, companySlug: 'acme', role: 'Designer', ...options })

  it('authorizes every voice call with the headset token', async () => {
    const s = session()
    expect(s.isStub).toBe(false)

    const started = await s.start()

    // `voice` carries the provider's realtime agent credentials when the server
    // offers one, and `questions` the full planned list.
    expect(started).toMatchObject({ company: 'acme', role: 'Designer', opening: OPENING, question: FIRST })
    expect(started.questions).toEqual(expect.arrayContaining([FIRST]))
    expect(started).toHaveProperty('voice')
    expect(api.calls[0].url).toBe(`${BASE}/api/voice/sessions`)

    const voice = api.calls.filter((c) => c.url.includes('/api/voice/'))
    expect(voice.length).toBeGreaterThan(0)
    for (const call of voice) expect(call.headers.authorization).toBe(`Bearer ${TOKEN}`)
  })

  it('asks for a quick interview only when one was picked', async () => {
    await session().start({ length: 'quick' })
    expect(api.calls[0].body).toEqual({ mode: 'interview', companySlug: 'acme', role: 'Designer', length: 'quick' })
    await session().start()
    expect(api.calls.at(-1).body).not.toHaveProperty('length')
  })

  it('starts the interview the VR picker chose, with the fields the phone sends', async () => {
    const [posting, role] = targetsOf({ postings: [{ id: 'p1', title: 'Analyst', company: 'ATB' }], targetRoles: ['Barista'] })
    await createApiSession({ getToken: () => TOKEN, baseUrl: BASE }).start(launchOf({ target: posting, difficulty: 'hard' }))
    expect(api.calls.at(-1).body).toEqual({ mode: 'interview', role: 'Analyst', difficulty: 'hard', postingId: 'p1' })

    await createApiSession({ getToken: () => TOKEN, baseUrl: BASE }).start(launchOf({ target: role, companySlug: 'helcim', difficulty: 'easy', length: 'quick' }))
    expect(api.calls.at(-1).body).toEqual({ mode: 'interview', companySlug: 'helcim', role: 'Barista', difficulty: 'easy', length: 'quick' })

    // nothing picked: no role, so the server uses the profile's first target role
    await createApiSession({ getToken: () => TOKEN, baseUrl: BASE }).start(launchOf())
    expect(api.calls.at(-1).body).toEqual({ mode: 'interview', difficulty: 'standard' })
  })

  it('fetches talking points for the current question from the session', async () => {
    const s = session()
    expect(await s.hint('Q')).toBeNull() // no session yet, no request
    await s.start()
    expect(await s.hint(FIRST)).toEqual(['Situation: the backlog', 'Result: [number] hours saved'])
    expect(api.of('/hint')[0]).toMatchObject({ url: `${BASE}/api/voice/sessions/sess_1/hint`, method: 'POST', body: { question: FIRST } })
  })

  // /turns scores and /next advances. They are fired together so the feedback
  // lands while the next line is still being spoken — both must go out per turn.
  it('scores and advances in the same turn', async () => {
    const s = session()
    const { question } = await s.start()
    const { score, next } = await s.submitAnswer({ question, answer: SOLID, durationMs: 12000 })

    expect(api.of('/turns')).toHaveLength(1)
    expect(api.of('/next')).toHaveLength(1)
    expect(api.of('/turns')[0].body).toEqual({ question, answer: SOLID, durationMs: 12000 })
    expect(score.scores.structure).toBe(4.2)
    expect(next).toEqual({ say: SECOND, kind: 'question' })
  })

  it('sends the live timestamps with a scored turn, and marks a reconnect conversation', async () => {
    const s = session()
    const { question } = await s.start()
    expect(s.sessionId).toBe('sess_1')
    await s.scoreTurn({ question, answer: SOLID, answerStartSec: 6.04, atSec: 14.26 })
    await s.scoreTurn({ question, answer: SOLID, answerStartSec: Number.NaN })
    expect(api.of('/turns')[0].body).toMatchObject({ answerStartSec: 6, atSec: 14.3 })
    expect(api.of('/turns')[1].body).not.toHaveProperty('answerStartSec')

    await s.attachConversation('conv_1')
    await s.attachConversation('conv_2', { reconnect: true })
    expect(api.of('/conversation').map((c) => c.body)).toEqual([{ conversationId: 'conv_1' }, { conversationId: 'conv_2', reconnect: true }])
  })

  // THE ONE THAT MATTERS. The Worker keeps no state: it finds its place by
  // string-matching this transcript against its planned questions. Paraphrase a
  // line and it silently re-asks question one forever.
  it('echoes the interviewer lines back verbatim', async () => {
    const s = session()
    const { question } = await s.start()
    await s.submitAnswer({ question, answer: SOLID, durationMs: 12000 })

    expect(api.of('/next')[0].body.transcript).toEqual([
      { speaker: 'interviewer', text: OPENING },
      { speaker: 'interviewer', text: FIRST },
      { speaker: 'candidate', text: SOLID },
    ])

    // And the line it just spoke carries into the next turn, still verbatim.
    await s.submitAnswer({ question: SECOND, answer: SOLID, durationMs: 12000 })
    expect(api.of('/next')[1].body.transcript).toContainEqual({
      speaker: 'interviewer',
      text: SECOND,
    })
  })

  // The server returns {} for scores when its scoring provider is down. The
  // interview has to keep going on an empty score, not throw.
  it('passes an empty score object straight through', async () => {
    api.fetch.mockImplementation(async (url, init = {}) => {
      api.calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : null, headers: init.headers ?? {} })
      if (url.endsWith('/turns')) return { ok: true, status: 200, json: async () => ({ scores: {}, delivery: { words: 28, fillerWords: 0, wordsPerMinute: null }, tip: '' }) }
      if (url.endsWith('/next')) return { ok: true, status: 200, json: async () => ({ say: SECOND, kind: 'follow_up' }) }
      return { ok: true, status: 200, json: async () => ({ sessionId: 'sess_1', opening: OPENING, questions: [{ text: FIRST }] }) }
    })

    const s = session()
    const { question } = await s.start()
    const { score, next } = await s.submitAnswer({ question, answer: SOLID, durationMs: 12000 })

    expect(score.scores).toEqual({})
    expect(score.delivery.wordsPerMinute).toBeNull()
    expect(next.kind).toBe('follow_up')
  })

  // The server 400s a finish with nothing scored, so ending early must not call it.
  it('does not call finish when no answer was ever scored', async () => {
    const s = session()
    await s.start()
    const afterStart = api.calls.length

    const { summary, prepList } = await s.finish()

    expect(api.calls).toHaveLength(afterStart)
    expect(api.of('/finish')).toHaveLength(0)
    expect(typeof summary).toBe('string')
    expect(prepList).toEqual([])
  })

  it('finishes through the API once a turn has been scored', async () => {
    const s = session()
    const { question } = await s.start()
    await s.submitAnswer({ question, answer: SOLID, durationMs: 12000 })

    const { summary, prepList } = await s.finish()

    expect(api.of('/finish')).toHaveLength(1)
    expect(api.of('/finish')[0].body).toEqual({ platform: 'vr' })
    expect(summary).toBe('Solid structure.')
    expect(prepList).toEqual([{ step: 'Add numbers', why: 'Verifiable' }])
  })

  it('starts the interview the phone asked for', async () => {
    await session().start({ mode: 'interview', companySlug: 'atb', role: 'Data Analyst' })

    expect(api.of('/api/voice/sessions')[0].body).toEqual({ mode: 'interview', companySlug: 'atb', role: 'Data Analyst' })
  })

  it('carries the road step, posting, difficulty and length from a phone launch', async () => {
    await session().start({ mode: 'interview', role: 'Data Analyst', stepId: 'st_1', postingId: 'p_1', difficulty: 'hard', length: 'quick' })

    expect(api.of('/api/voice/sessions')[0].body).toEqual({
      mode: 'interview', companySlug: 'acme', role: 'Data Analyst', stepId: 'st_1', postingId: 'p_1', difficulty: 'hard', length: 'quick',
    })
  })

  it('refuses to call the API before the headset has signed in', async () => {
    await expect(session({ getToken: () => null }).start()).rejects.toBeInstanceOf(SignedOutError)
    expect(api.calls).toHaveLength(0)
  })

  it('signs the headset out when the server no longer knows its token', async () => {
    api.fetch.mockImplementation(async () => ({ ok: false, status: 401, json: async () => ({}) }))
    const onSignedOut = vi.fn()

    await expect(session({ onSignedOut }).start()).rejects.toBeInstanceOf(SignedOutError)
    expect(onSignedOut).toHaveBeenCalledOnce()
  })
})
