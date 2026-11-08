// Gemini Live voice session for the VR interview.
//
// The caller already holds { sessionId, token, model, expiresAt } from
// POST /api/interview/start. `token` is a short-lived ephemeral token minted by
// the Worker — the Gemini API key only ever exists as a Worker secret, so there
// is deliberately no env lookup anywhere in this folder.
//
// Shape of one question:
//   await live.askQuestion(text)   // model reads it out loud, resolves when done
//   await live.startAnswer()       // mic opens, answer is recorded locally
//   const answer = live.stopAnswer()
//   // caller POSTs answer to /api/interview/:id/answer for scoring
//
// Answers are recorded on this side rather than read off Gemini's live
// transcription, which proved unreliable over ephemeral tokens. The recording is
// pure Web Audio, so a socket drop mid-answer loses nothing.

import {
  MIC_SAMPLE_RATE,
  PLAYBACK_SAMPLE_RATE,
  bytesToPcm16,
  createMicCapture,
  createPlaybackQueue,
  encodeWav,
  fromBase64,
  toBase64,
} from './audio.js'

const DEFAULT_HOST = 'generativelanguage.googleapis.com'
const DEFAULT_API_VERSION = 'v1beta'
const DEFAULT_MODEL = 'gemini-2.0-flash-live-001'
const DEFAULT_VOICE = 'Puck'

const SETUP_TIMEOUT_MS = 10000
const BACKOFF_MS = [400, 900, 1800, 3600, 7000]
const TURN_MS_PER_WORD = 420
const TURN_FLOOR_MS = 7000

const DEFAULT_SYSTEM_INSTRUCTION = [
  'You are a calm, professional interviewer in a mock job interview.',
  'When a user message begins with "Ask this question verbatim:", read the question that follows word for word, then stop and wait.',
  'Never answer your own question, never add extra questions, and never explain what you are doing.',
  'Any acknowledgement of an answer is at most one short sentence.',
].join(' ')

const words = (text) => text.trim().split(/\s+/).filter(Boolean).length

function socketUrl({ host, apiVersion, tokenParam, token }) {
  const service = `google.ai.generativelanguage.${apiVersion}.GenerativeService.BidiGenerateContent`
  return `wss://${host}/ws/${service}?${tokenParam}=${encodeURIComponent(token)}`
}

export function createGeminiLive({
  sessionId = null,
  token = null,
  model = DEFAULT_MODEL,
  expiresAt = null,
  voiceName = DEFAULT_VOICE,
  systemInstruction = DEFAULT_SYSTEM_INSTRUCTION,
  host = DEFAULT_HOST,
  apiVersion = DEFAULT_API_VERSION,
  tokenParam = 'access_token',
  audioField = 'audio', // 'mediaChunks' is the older name for the same payload
  reAskOnReconnect = true,
  onState = null,
  onError = null,
  onCaption = null,
  onSpeakingChange = null,
  socketFactory = null, // lets a test or a local mock stand in for WebSocket
} = {}) {
  const answers = []
  const playback = createPlaybackQueue({
    sampleRate: PLAYBACK_SAMPLE_RATE,
    onPlayingChange: (playing) => onSpeakingChange?.(playing),
  })
  const mic = createMicCapture({ sampleRate: MIC_SAMPLE_RATE, onAudio: sendMicAudio })

  let socket = null
  let state = 'closed' // connecting | open | reconnecting | closed
  let attempt = 0
  let retryTimer = null
  let finished = false
  let turn = null
  let recording = null
  let currentQuestion = null
  let questionSettled = true
  let resumeHandle = null

  function setState(next) {
    if (state === next) return
    state = next
    onState?.(state)
  }

  function report(reason, message) {
    onError?.({ reason, message })
    return { ok: false, reason, message }
  }

  function tokenExpired() {
    if (!expiresAt) return false
    const at = Date.parse(expiresAt)
    return Number.isFinite(at) && at <= Date.now()
  }

  function send(payload) {
    if (socket?.readyState !== 1) return false
    socket.send(JSON.stringify(payload))
    return true
  }

  const sendRealtime = (input) => send({ realtimeInput: input })

  function buildSetup() {
    const setup = {
      model: model.startsWith('models/') ? model : `models/${model}`,
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
      },
      systemInstruction: { parts: [{ text: systemInstruction }] },
      // We drive every turn ourselves, so the server must not decide on its own
      // that the candidate stopped talking and start answering over them.
      realtimeInputConfig: { automaticActivityDetection: { disabled: true } },
      outputAudioTranscription: {},
      sessionResumption: resumeHandle ? { handle: resumeHandle } : {},
    }
    return setup
  }

  function settleTurn(result) {
    if (!turn) return
    const { resolve, timer } = turn
    turn = null
    clearTimeout(timer)
    resolve(result)
  }

  function awaitTurn(text) {
    settleTurn({ ok: false, reason: 'superseded', message: 'A newer turn replaced this one.' })
    return new Promise((resolve) => {
      // Same reason speech.js carries a watchdog: if the socket stalls mid-turn,
      // the interview must not wedge waiting for a turnComplete that never comes.
      const budget = Math.max(TURN_FLOOR_MS, words(text) * TURN_MS_PER_WORD + 5000)
      const timer = setTimeout(() => settleTurn({ ok: true, timedOut: true }), budget)
      turn = { resolve, timer }
    })
  }

  async function endModelTurn() {
    questionSettled = true
    await playback.whenDrained()
    settleTurn({ ok: true, timedOut: false })
  }

  function handleMessage(message, onSetup) {
    if (message.setupComplete) {
      attempt = 0
      setState('open')
      onSetup?.({ ok: true })
      return
    }

    if (message.sessionResumptionUpdate?.resumable) {
      resumeHandle = message.sessionResumptionUpdate.newHandle ?? resumeHandle
    }

    const content = message.serverContent
    if (content) {
      if (content.interrupted) playback.clear()

      for (const part of content.modelTurn?.parts ?? []) {
        const inline = part.inlineData ?? part.inline_data
        if (inline?.data) playback.push(bytesToPcm16(fromBase64(inline.data)))
        if (part.text) onCaption?.(part.text)
      }

      const spoken = content.outputTranscription?.text
      if (spoken) onCaption?.(spoken)

      if (content.turnComplete || content.generationComplete) endModelTurn()
    }

    // The server warns before it drops a long-lived session; onclose then runs
    // the normal reconnect path.
    if (message.goAway) setState('reconnecting')
  }

  function decode(data) {
    if (typeof data === 'string') return JSON.parse(data)
    if (data instanceof ArrayBuffer) return JSON.parse(new TextDecoder().decode(data))
    return null
  }

  function openSocket() {
    return new Promise((resolve) => {
      if (typeof WebSocket === 'undefined' && !socketFactory) {
        resolve(report('unsupported', 'This browser has no WebSocket support.'))
        return
      }

      let settled = false
      const done = (result) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(result)
      }

      let ws
      try {
        const url = socketUrl({ host, apiVersion, tokenParam, token })
        ws = socketFactory ? socketFactory(url) : new WebSocket(url)
      } catch (err) {
        done({ ok: false, reason: 'socket', message: err?.message ?? 'Could not open the Gemini Live socket.' })
        return
      }

      // Binary frames as ArrayBuffer, not Blob: parsing stays synchronous, which
      // is what keeps streamed audio chunks in the order they arrived.
      ws.binaryType = 'arraybuffer'
      socket = ws

      const timer = setTimeout(
        () => done({ ok: false, reason: 'timeout', message: 'Gemini Live did not finish the handshake.' }),
        SETUP_TIMEOUT_MS,
      )

      ws.onopen = () => send({ setup: buildSetup() })
      ws.onmessage = (event) => {
        let message
        try {
          message = decode(event.data)
        } catch {
          return // a frame we cannot parse is never fatal
        }
        if (message) handleMessage(message, done)
      }
      ws.onerror = () => {} // onclose always follows, and carries the code
      ws.onclose = (event) => {
        done({
          ok: false,
          reason: 'closed',
          message: `Gemini Live closed the connection (${event?.code ?? 0}${event?.reason ? `: ${event.reason}` : ''}).`,
        })
        handleClose(event)
      }
    })
  }

  function handleClose(event) {
    socket = null
    if (finished) return

    if (tokenExpired()) {
      setState('closed')
      report('token-expired', 'The interview token expired. Start a new interview to get a fresh one.')
      return
    }

    if (attempt >= BACKOFF_MS.length) {
      setState('closed')
      report('disconnected', `Lost the connection to the interviewer (${event?.code ?? 0}).`)
      return
    }

    const delay = BACKOFF_MS[attempt++]
    setState('reconnecting')
    retryTimer = setTimeout(async () => {
      retryTimer = null
      if (finished) return
      const result = await openSocket()
      // A failed attempt closes again, which lands back here with a longer delay.
      if (!result.ok) return
      if (reAskOnReconnect && currentQuestion && !questionSettled) askQuestion(currentQuestion)
    }, delay)
  }

  function sendMicAudio(pcm16) {
    if (recording) {
      recording.chunks.push(pcm16)
      recording.samples += pcm16.length
    }
    // Gemini hears the answer so it can follow up naturally; scoring always uses
    // the local copy above.
    const payload = { mimeType: `audio/pcm;rate=${MIC_SAMPLE_RATE}`, data: toBase64(pcm16) }
    sendRealtime(audioField === 'mediaChunks' ? { mediaChunks: [payload] } : { audio: payload })
  }

  async function connect() {
    if (!token) return report('missing-token', 'No interview token. Call POST /api/interview/start first.')
    if (tokenExpired()) return report('token-expired', 'The interview token has already expired.')

    finished = false
    attempt = 0
    setState('connecting')
    await playback.resume()

    const result = await openSocket()
    if (!result.ok && state !== 'reconnecting') setState('closed')
    if (!result.ok) onError?.({ reason: result.reason, message: result.message })
    return result
  }

  async function askQuestion(text) {
    if (!text) return { ok: false, reason: 'empty', message: 'No question text.' }
    currentQuestion = text
    questionSettled = false
    playback.clear() // drop anything left over from the previous turn

    const waiting = awaitTurn(text)
    const sent = send({
      clientContent: {
        turns: [{ role: 'user', parts: [{ text: `Ask this question verbatim: ${text}` }] }],
        turnComplete: true,
      },
    })
    if (!sent) {
      settleTurn({ ok: false, reason: 'offline', message: 'Not connected to the interviewer.' })
      return waiting
    }
    return waiting
  }

  function sendText(text, { reply = true } = {}) {
    return send({
      clientContent: { turns: [{ role: 'user', parts: [{ text }] }], turnComplete: reply },
    })
  }

  async function startAnswer() {
    const ready = await mic.start()
    if (!ready.ok) {
      onError?.({ reason: ready.reason, message: ready.message })
      return ready
    }
    recording = { chunks: [], samples: 0 }
    sendRealtime({ activityStart: {} })
    mic.setEnabled(true)
    return { ok: true }
  }

  function stopAnswer({ question = currentQuestion } = {}) {
    mic.setEnabled(false)
    sendRealtime({ activityEnd: {} })

    const taken = recording
    recording = null
    const chunks = taken?.chunks ?? []
    const samples = taken?.samples ?? 0
    const answer = {
      question,
      audioBase64: samples ? toBase64(encodeWav(chunks, MIC_SAMPLE_RATE)) : null,
      mimeType: 'audio/wav',
      seconds: Number((samples / MIC_SAMPLE_RATE).toFixed(2)),
      empty: samples === 0,
    }
    answers.push(answer)
    return answer
  }

  // Mic-denied fallback. Kept in the same list as spoken answers so the caller
  // submits both the same way.
  function recordTypedAnswer(text, { question = currentQuestion } = {}) {
    const answer = { question, text, audioBase64: null, mimeType: null, seconds: 0, empty: !text }
    answers.push(answer)
    sendText(`My answer: ${text}`, { reply: false })
    return answer
  }

  function interrupt() {
    playback.clear()
    settleTurn({ ok: true, interrupted: true })
  }

  async function close() {
    finished = true
    clearTimeout(retryTimer)
    retryTimer = null
    settleTurn({ ok: false, reason: 'closed', message: 'The session was closed.' })
    mic.stop()
    try {
      socket?.close(1000, 'interview finished')
    } catch {
      // already closing
    }
    socket = null
    await playback.close()
    setState('closed')
  }

  return {
    sessionId,

    get state() {
      return state
    },
    get micState() {
      return mic.state
    },
    get micDenied() {
      return mic.denied
    },
    // Collected answers never depend on the socket, so a drop cannot lose them.
    get answers() {
      return answers.slice()
    },
    get analyser() {
      return playback.analyser
    },

    connect,
    askQuestion,
    sendText,
    startAnswer,
    stopAnswer,
    recordTypedAnswer,
    interrupt,

    isSpeaking: () => playback.isPlaying(),
    getAmplitude: () => playback.getAmplitude(),
    setMuted: (muted) => playback.setMuted(muted),
    close,
  }
}
