// The browser side of a spoken session, the web counterpart of ElevenLabsVoiceEngine.swift. ElevenLabs owns
// listening, turn-taking and interruptions; this only relays what happens to the screen.
import { Conversation } from '@elevenlabs/client'

export class MicDenied extends Error {}

/** The server hands over { kind: 'elevenlabs', conversationToken, overrides, dynamicVariables }. */
export function readCredentials(raw) {
  if (!raw || raw.kind !== 'elevenlabs' || !raw.conversationToken) return null
  return raw
}

/**
 * Starts the call. `on` gets: state('connecting'|'listening'|'speaking'|'thinking'), line(speaker, text), ended(), failed(message).
 * Returns { stop, level } where level() is the loudness of whoever is talking, 0–1.
 */
export async function startVoice(rawCredentials, on) {
  const credentials = readCredentials(rawCredentials)
  if (!credentials) throw new Error("This server didn't hand out a voice connection. Try again in a moment.")

  let conversation = null
  let mode = 'connecting'
  let stopped = false
  const setState = (next) => {
    mode = next
    on.state(next)
  }
  on.state('connecting')

  try {
    // ask first, so a refusal can fall back to typing instead of failing inside the SDK
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((t) => t.stop())
  } catch (e) {
    throw new MicDenied(e?.message ?? 'microphone blocked', { cause: e })
  }

  try {
    conversation = await Conversation.startSession({
      conversationToken: credentials.conversationToken,
      connectionType: 'webrtc',
      overrides: credentials.overrides,
      dynamicVariables: credentials.dynamicVariables,
      onConnect: () => setState('speaking'),
      onModeChange: ({ mode: next }) => setState(next === 'speaking' ? 'speaking' : 'listening'),
      onMessage: ({ message, role, source }) => {
        const speaker = (role ?? (source === 'ai' ? 'agent' : 'user')) === 'agent' ? 'agent' : 'person'
        on.line(speaker, message)
        // the person finished a line: the interviewer is working out what to say
        if (speaker === 'person' && mode === 'listening') setState('thinking')
      },
      onError: (message) => on.failed(typeof message === 'string' ? message : 'The voice connection had a problem.'),
      onDisconnect: () => {
        if (!stopped) on.ended()
      },
    })
  } catch (e) {
    throw new Error(`Couldn't reach the interviewer. ${e?.message ?? ''}`.trim(), { cause: e })
  }

  return {
    stop() {
      stopped = true
      const c = conversation
      conversation = null
      c?.endSession().catch(() => {})
      on.ended()
    },
    level() {
      if (!conversation) return 0
      try {
        return mode === 'speaking' ? conversation.getOutputVolume() : conversation.getInputVolume()
      } catch {
        return 0
      }
    },
  }
}

/**
 * Pairs a live transcript into scorable turns (TranscriptTurns.swift): everything the person says after one
 * interviewer line, until the interviewer speaks again.
 */
export class TranscriptTurns {
  question = null
  answer = []
  startedAt = null
  lastAt = null

  add(speaker, text, at = Date.now()) {
    const trimmed = text.trim()
    if (!trimmed) return null
    if (speaker === 'agent') {
      const finished = this.flush()
      const spoken = trimmed.replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim()
      if (spoken) this.question = spoken
      return finished
    }
    if (!this.question) return null
    this.answer.push(trimmed)
    this.startedAt ??= at
    this.lastAt = at
    return null
  }

  flush() {
    const { question, answer, startedAt, lastAt } = this
    this.answer = []
    this.startedAt = null
    this.lastAt = null
    if (!question || !answer.length) return null
    return { question, answer: answer.join(' '), durationMs: Math.max((lastAt ?? 0) - (startedAt ?? 0), 2000) }
  }
}
