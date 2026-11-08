// The Raven Worker's voice practice API, behind the same interface as the stub
// and the older createApiSession in session.js (start / nextQuestion /
// submitAnswer / finish). Used once the headset is signed in; the bearer token
// comes from src/headset.
//
//   POST /api/voice/sessions            { mode, companySlug?, role?, difficulty? }
//                                       -> { sessionId, opening, questions: [{ text, reported }] }
//   POST /api/voice/sessions/:id/turns  { question, answer, durationMs }
//                                       -> { scores: { structure, relevance, specificity, confidence }, delivery, tip }
//   POST /api/voice/sessions/:id/finish -> { overall: 0-100, verdict, nextSteps, ... }

import { API_URL, SignedOutError } from '../headset/api.js'

// The server scores these four; the panel reads them off the result.
export const VOICE_DIMENSIONS = ['structure', 'relevance', 'specificity', 'confidence']

export function createVoiceSession({ getToken, baseUrl = API_URL, companySlug, role, difficulty, onSignedOut } = {}) {
  let sessionId = null
  let questions = []
  let index = 0
  let turns = 0

  async function call(path, body) {
    const token = getToken?.()
    if (!token) throw new SignedOutError('sign in on the keypad first')
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body ?? {}),
    })
    if (response.status === 401) {
      onSignedOut?.()
      throw new SignedOutError('this headset needs to sign in again')
    }
    if (!response.ok) {
      const { error } = await response.json().catch(() => ({}))
      throw new Error(error ?? `${path} failed (${response.status})`)
    }
    return response.json()
  }

  return {
    isStub: false,

    // `launch` is what the phone sent ({ companySlug, role }) or nothing when
    // Begin was pressed in the room; the factory defaults fill the gaps.
    async start(launch = {}) {
      const body = compact({
        mode: 'interview',
        companySlug: launch.companySlug ?? companySlug,
        role: launch.role ?? role,
        difficulty: launch.difficulty ?? difficulty,
      })
      const started = await call('/api/voice/sessions', body)
      sessionId = started.sessionId
      questions = (started.questions ?? []).map((q, i) => ({
        id: `q${i}`,
        text: q.text,
        isSeeded: q.reported !== true,
      }))
      index = 0
      turns = 0
      return {
        company: labelFor(body.companySlug),
        role: body.role ?? 'Interview practice',
        questionCount: questions.length,
        opening: started.opening ?? null,
        live: null,
      }
    },

    async nextQuestion() {
      return index < questions.length ? questions[index++] : null
    },

    async submitAnswer({ question, transcript = '', durationMs = 0 }) {
      const answer = transcript.trim()
      if (!answer) throw new Error('Nothing was heard. Hold the button and speak your answer.')
      const scored = await call(`/api/voice/sessions/${sessionId}/turns`, {
        question,
        answer,
        durationMs: Math.max(0, Math.round(durationMs)),
      })
      turns += 1
      return toAnswerScore(scored, answer)
    },

    async finish() {
      if (turns === 0) return { overall: 0, summary: 'No answers recorded.' }
      const debrief = await call(`/api/voice/sessions/${sessionId}/finish`)
      return toSummary(debrief)
    },
  }
}

// Server TurnScore -> the AnswerScore shape the panels already render.
export function toAnswerScore({ scores = {}, delivery = {}, tip = '' }, transcript = '') {
  const result = {
    dimensions: VOICE_DIMENSIONS,
    fillerWords: delivery.fillerWords ?? 0,
    wpm: delivery.wordsPerMinute ?? 0,
    tip,
    strongerAnswer: null,
    transcript,
  }
  for (const dim of VOICE_DIMENSIONS) result[dim] = scores[dim] ?? 0
  return result
}

// Debrief (0-100) -> the /5 the ReviewPanel shows, plus one spoken paragraph.
export function toSummary({ overall = 0, verdict = '', nextSteps = [] }) {
  const parts = [verdict, ...nextSteps.slice(0, 2)].filter(Boolean)
  return {
    overall: Math.round((overall / 20) * 10) / 10,
    summary: parts.join(' ') || 'Interview complete.',
  }
}

const KNOWN_COMPANIES = { atb: 'ATB', benevity: 'Benevity', 'neo-financial': 'Neo Financial', helcim: 'Helcim' }

function labelFor(slug) {
  if (!slug) return 'Raven'
  return KNOWN_COMPANIES[slug] ?? slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

const compact = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null))
