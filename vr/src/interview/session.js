// ─────────────────────────────────────────────────────────────────────────────
// THE INTEGRATION SEAM.
//
// The VR scene talks to the backend through this module and nothing else.
//
//   start(launch?) -> { company, role, opening, question, isStub }
//                     `launch` is what the phone queued ({ companySlug, role })
//   submitAnswer({ question, answer, durationMs })
//                  -> { score, next: { say, kind } }
//   finish()       -> { summary, prepList }
//
// `next.kind` is 'follow_up' | 'question' | 'wrap_up'. A wrap_up means the
// interview is over and finish() should be called.
//
// The Worker keeps no conversation state: it works out where we are by matching
// the transcript we echo back against its planned questions. So every line the
// interviewer speaks must be appended VERBATIM — paraphrase it and the server
// loses its place and repeats question one forever.
// ─────────────────────────────────────────────────────────────────────────────

import { DEFAULT_SCORE, EXAMPLE_QUESTIONS, EXAMPLE_SCORES } from './questions.js'
import { API_URL, SignedOutError } from '../headset/api.js'
import { toHundred } from './scores.js'

const STUB_LATENCY_MS = 650

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// `getToken` hands over the headset's bearer token from the keypad sign-in. It
// is read on every call, so a silent refresh mid-interview just carries on.
export function createApiSession({ getToken, onSignedOut, baseUrl = API_URL, companySlug, role = 'Software Developer' } = {}) {
  let sessionId = null
  let transcript = []
  let scored = 0

  async function call(path, { method = 'GET', body } = {}) {
    const token = getToken?.()
    if (!token) throw new SignedOutError('Sign in on the keypad first.')
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (response.status === 401) {
      onSignedOut?.()
      throw new SignedOutError('This headset needs to sign in again.')
    }
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || `${method} ${path} failed (${response.status})`)
    return data
  }

  const said = (text) => transcript.push({ speaker: 'interviewer', text })

  return {
    isStub: false,

    async start(launch = {}) {
      const slug = launch.companySlug ?? companySlug
      // length 'quick' is the one-minute taster (two questions, no follow-ups); left off, the server runs a full one
      const body = { mode: 'interview', ...(slug ? { companySlug: slug } : {}), role: launch.role ?? role, ...(launch.length ? { length: launch.length } : {}) }
      const started = await call('/api/voice/sessions', { method: 'POST', body })
      sessionId = started.sessionId
      transcript = []
      scored = 0

      const first = started.questions?.[0]?.text ?? null
      if (started.opening) said(started.opening)
      if (first) said(first)

      return {
        company: started.companySlug ?? slug ?? null,
        role: body.role,
        opening: started.opening ?? null,
        question: first,
        // The provider's own realtime voice agent. When present the client talks
        // to it directly and it handles speech in, the model, and speech out —
        // the same agent the phone app uses, so both sound identical. The signed
        // URL carries its own auth; no key ever reaches this app.
        voice: started.provider ? { provider: started.provider, ...started.credentials } : null,
        questions: (started.questions ?? []).map((q) => q.text),
      }
    },

    // Scoring only. The realtime voice agent drives the conversation itself, so
    // there is no /next call on that path — just score what was said.
    // answerStartSec/atSec are seconds since the call connected; the replay seeks to them without re-reading the transcript
    async scoreTurn({ question, answer = '', durationMs = 0, answerStartSec, atSec }) {
      const score = await call(`/api/voice/sessions/${sessionId}/turns`, {
        method: 'POST',
        body: { question, answer: answer || '(no answer given)', durationMs: Math.round(durationMs), ...secondsOf({ answerStartSec, atSec }) },
      })
      scored++
      return score
    },

    async submitAnswer({ question, answer = '', durationMs = 0 }) {
      transcript.push({ speaker: 'candidate', text: answer })

      // Independent endpoints: /turns scores, /next advances. They run together
      // so feedback lands while the next line is being spoken, but settled
      // separately: losing a score costs a panel, losing the transcript line
      // costs the whole conversation.
      const [scoring, advancing] = await Promise.allSettled([
        call(`/api/voice/sessions/${sessionId}/turns`, {
          method: 'POST',
          body: { question, answer: answer || '(no answer given)', durationMs: Math.round(durationMs) },
        }),
        call(`/api/voice/sessions/${sessionId}/next`, {
          method: 'POST',
          // The server caps this at 80 lines.
          body: { answer, transcript: transcript.slice(-80) },
        }),
      ])

      if (advancing.status === 'rejected') throw advancing.reason
      const next = advancing.value
      if (next?.say) said(next.say)

      if (scoring.status === 'fulfilled') scored++
      return { score: scoring.status === 'fulfilled' ? scoring.value : null, next }
    },

    get sessionId() {
      return sessionId
    },

    // Links the ElevenLabs recording to this session, so it can be replayed and deleted with it. A reconnect's
    // new conversation is linked too, only so deleting the session deletes it; the replay stays on the first.
    attachConversation(conversationId, { reconnect = false } = {}) {
      const body = reconnect ? { conversationId, reconnect: true } : { conversationId }
      return call(`/api/voice/sessions/${sessionId}/conversation`, { method: 'POST', body })
    },

    async finish() {
      // The server 400s if nothing was ever scored.
      if (!scored) return { summary: 'No answers were recorded.', prepList: [] }
      return call(`/api/voice/sessions/${sessionId}/finish`, {
        method: 'POST',
        body: { platform: 'vr' },
      })
    },
  }
}

// Example data, so the demo still runs if the Worker is unreachable. Everything
// it returns is flagged isSeeded and the panels badge it EXAMPLE.
export function createStubSession({ company = 'Example Co.', role = 'Software Developer' } = {}) {
  let index = 0
  const given = []

  return {
    isStub: true,

    // A phone launch may name a company/role; the stub shows them and asks
    // the same example questions regardless.
    async start(launch = {}) {
      await wait(200)
      index = 0
      given.length = 0
      return {
        company: launch.companySlug ?? company,
        role: launch.role ?? role,
        opening: `Hi, thanks for coming in. We're meeting about the ${role} role. Ready to start?`,
        question: EXAMPLE_QUESTIONS[index++].text,
        voice: null,
        questions: EXAMPLE_QUESTIONS.map((q) => q.text),
        isSeeded: true,
      }
    },

    async scoreTurn(turn) {
      const { score } = await this.submitAnswer(turn)
      return score
    },

    async submitAnswer({ question, answer = '', durationMs = 0 }) {
      await wait(STUB_LATENCY_MS)
      const base = EXAMPLE_SCORES[`q${index}`] ?? DEFAULT_SCORE
      const words = answer.trim().split(/\s+/).filter(Boolean).length
      const seconds = Math.max(1, durationMs / 1000)
      const thin = words > 0 && words < 25

      const score = {
        scores: {
          structure: clamp(base.structure - (thin ? 1 : 0)),
          relevance: clamp(base.relevance - (thin ? 1 : 0)),
          specificity: clamp(base.clarity - (thin ? 2 : 0)),
          confidence: clamp(base.confidence),
        },
        delivery: {
          words,
          fillerWords: countFillers(answer),
          wordsPerMinute: words && durationMs ? Math.round((words / seconds) * 60) : null,
        },
        tip: thin
          ? 'That was very short. Give the situation, what you did, then the result.'
          : base.tip,
      }
      given.push(score)

      // Mirror the real server: probe a thin answer once, otherwise move on.
      const next = thin
        ? { say: 'What was your part in that, specifically?', kind: 'follow_up' }
        : index < EXAMPLE_QUESTIONS.length
          ? { say: EXAMPLE_QUESTIONS[index++].text, kind: 'question' }
          : { say: "That's everything from me. Thanks so much, you'll hear from us soon.", kind: 'wrap_up' }

      return { score, next }
    },

    async finish() {
      await wait(200)
      return {
        // out of 100, like the real debrief
        overall: overallOf(given),
        summary: 'Your structure is solid. The gap is specifics — every answer needs one number.',
        prepList: [
          { step: 'Write three stories in situation-action-result form', why: 'Structure is what interviewers grade first' },
          { step: 'Put a number in each one', why: 'A measurable result is what makes an answer verifiable' },
        ],
      }
    },
  }
}

// only real, non-negative numbers go out; anything else is left for the server's transcript fallback
const secondsOf = (timing) =>
  Object.fromEntries(Object.entries(timing).filter(([, v]) => typeof v === 'number' && Number.isFinite(v) && v >= 0).map(([k, v]) => [k, Math.round(v * 10) / 10]))

const clamp = (n) => Math.min(5, Math.max(1, n))
const overallOf = (scores) => {
  const ratings = scores.flatMap((score) => Object.values(score.scores))
  return ratings.length ? Math.round(ratings.reduce((sum, rating) => sum + toHundred(rating), 0) / ratings.length) : 0
}
const countFillers = (text) => (text.match(/\b(um+|uh+|erm|like|you know)\b/gi) ?? []).length

// Signed in on the keypad -> the Skillit voice API with that bearer token.
// Not signed in (the candidate chose example data), or VITE_USE_STUB -> the stub.
export function createSession({ getToken, ...options } = {}) {
  if (getToken && import.meta.env?.VITE_USE_STUB !== 'true') return createApiSession({ getToken, ...options })
  return createStubSession(options)
}
