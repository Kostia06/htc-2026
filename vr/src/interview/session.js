// ─────────────────────────────────────────────────────────────────────────────
// THE INTEGRATION SEAM.
//
// The VR scene talks to the backend through this module and nothing else. Both
// implementations below satisfy the same interface, so switching from example
// data to the live Worker is one env var and zero changes under src/scene/.
//
//   start()                      -> { company, role, questionCount }
//   nextQuestion()               -> { id, text, isSeeded } | null
//   submitAnswer({ questionId, question, transcript, audioBase64, mimeType, durationMs })
//                                -> AnswerScore
//   finish()                     -> { overall, summary }
//   isStub                       -> true while running on example data
//
// AnswerScore matches the Worker contract exactly:
//   { structure, clarity, confidence, relevance } each 1..5,
//   fillerWords, wpm, strongerAnswer, tip, transcript
//
// Every method is async. The scene already handles latency (the avatar holds a
// thinking beat) and rejections (the error surfaces in the panel), so real
// network behaviour needs no extra work here.
// ─────────────────────────────────────────────────────────────────────────────

import { DEFAULT_SCORE, EXAMPLE_QUESTIONS, EXAMPLE_SCORES } from './questions.js'

const STUB_LATENCY_MS = 650 // pretend the model is thinking, so timing bugs show up early
const DIMENSIONS = ['structure', 'clarity', 'confidence', 'relevance']

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))

export function createStubSession({ company = 'Example Co.', role = 'Software Developer' } = {}) {
  let index = 0
  let scored = []

  return {
    isStub: true,

    async start() {
      await wait(200)
      index = 0
      scored = []
      return { company, role, questionCount: EXAMPLE_QUESTIONS.length, live: null }
    },

    async nextQuestion() {
      await wait(STUB_LATENCY_MS)
      if (index >= EXAMPLE_QUESTIONS.length) return null
      return EXAMPLE_QUESTIONS[index++]
    },

    async submitAnswer({ questionId, transcript = '', durationMs = 0 }) {
      await wait(STUB_LATENCY_MS)
      const base = EXAMPLE_SCORES[questionId] ?? DEFAULT_SCORE

      // React to what the candidate actually did, so the demo is not a fixed
      // recording. Real scoring replaces all of this.
      const words = transcript.trim().split(/\s+/).filter(Boolean).length
      const seconds = Math.max(1, durationMs / 1000)
      const tooShort = words > 0 && words < 25

      const result = { ...base, transcript }
      for (const dim of DIMENSIONS) {
        result[dim] = clamp(base[dim] + (tooShort ? -1 : 0), 1, 5)
      }
      if (words > 0) result.wpm = Math.round((words / seconds) * 60)
      if (tooShort) {
        result.tip =
          'That was very short. Interviewers read brevity here as not having an example ready — give the situation, your action, then the result.'
      }

      scored.push(result)
      return result
    },

    async finish() {
      await wait(200)
      return { overall: aggregate(scored), summary: summarize(scored) }
    },
  }
}

// The live path. Shipping it now rather than at 3am means integration is a flag
// flip, not a rewrite.
export function createApiSession({ baseUrl, companySlug, role }) {
  let sessionId = null
  let authToken = null
  let questions = []
  let index = 0
  let scored = []

  async function call(path, { method = 'GET', body } = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!response.ok) {
      throw new Error(`${method} ${path} failed (${response.status})`)
    }
    return response.json()
  }

  return {
    isStub: false,

    async start() {
      const session = await call('/api/session', { method: 'POST' })
      authToken = session.token
      localStorage.setItem('aim.token', session.token)

      const started = await call('/api/interview/start', {
        method: 'POST',
        body: { companySlug, role },
      })
      sessionId = started.sessionId
      // The API flags genuinely reported questions; the scene thinks in terms of
      // seeded ones, so translate here and keep one concept in the UI.
      questions = (started.questions ?? []).map((q, i) => ({
        id: `q${i}`,
        text: q.text,
        isSeeded: q.reported !== true,
      }))
      index = 0
      scored = []
      return {
        company: companySlug,
        role,
        questionCount: questions.length,
        // Gemini Live credentials, deliberately distinct from the bearer token
        // above. These are short-lived and are the only Gemini credential a
        // client is ever allowed to hold — the API key stays a Worker secret.
        live: {
          sessionId: started.sessionId,
          token: started.token,
          model: started.model,
          expiresAt: started.expiresAt,
        },
      }
    },

    async nextQuestion() {
      return index < questions.length ? questions[index++] : null
    },

    async submitAnswer({ question, transcript, audioBase64, mimeType, durationMs = 0 }) {
      const result = await call(`/api/interview/${sessionId}/answer`, {
        method: 'POST',
        body: {
          question,
          ...(audioBase64 ? { audioBase64, mimeType } : { text: transcript }),
          seconds: Math.round(durationMs / 1000),
        },
      })
      scored.push(result)
      return result
    },

    async finish() {
      return { overall: aggregate(scored), summary: summarize(scored) }
    },
  }
}

function aggregate(scores) {
  if (!scores.length) return 0
  const total = scores.reduce(
    (sum, s) => sum + DIMENSIONS.reduce((d, key) => d + (s[key] ?? 0), 0) / DIMENSIONS.length,
    0,
  )
  return Math.round((total / scores.length) * 10) / 10
}

function summarize(scores) {
  if (!scores.length) return 'No answers recorded.'
  const weakest = DIMENSIONS.map((dim) => ({
    dim,
    mean: scores.reduce((sum, s) => sum + (s[dim] ?? 0), 0) / scores.length,
  })).sort((a, b) => a.mean - b.mean)[0]

  const fillers = Math.round(scores.reduce((sum, s) => sum + (s.fillerWords ?? 0), 0) / scores.length)
  return `Your weakest dimension was ${weakest.dim}, averaging ${weakest.mean.toFixed(1)} out of 5, with about ${fillers} filler words per answer.`
}

const API_URL = import.meta.env?.VITE_API_URL

export const createSession = (options = {}) =>
  API_URL
    ? createApiSession({ baseUrl: API_URL, companySlug: 'example-co', role: 'Software Developer', ...options })
    : createStubSession(options)
