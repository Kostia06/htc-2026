// ElevenLabs Conversational AI session for the VR interview.
//
// This is the same voice agent the phone app talks to, so both platforms sound
// identical. ElevenLabs does speech-to-text, the LLM and text-to-speech, which
// is why this module replaces the whole home-grown speech stack: there is no
// local TTS, no browser SpeechRecognition and no silence detection here. The
// interview questions arrive inside the system prompt the Worker composed and
// handed us as `overrides`.
//
// The signed URL from POST /api/voice/sessions carries its own auth and expires.
// No API key is read anywhere in this file, by design.
//
//   const voice = createElevenLabsSession({ signedUrl, overrides, onTurn, ... })
//   await voice.connect()        // mic opens, agent starts talking
//   voice.getAmplitude()         // per-frame, drives the avatar's visemes
//   await voice.disconnect()     // flushes the last Q/A pair first

import {
  MIC_SAMPLE_RATE,
  PLAYBACK_SAMPLE_RATE,
  bytesToPcm16,
  createMicCapture,
  createPlaybackQueue,
  float32ToPcm16,
  fromBase64,
  pcm16ToFloat32,
  resample,
  toBase64,
} from './audio.js'

const BACKOFF_MS = [500, 1200, 2500]
const INIT_TIMEOUT_MS = 12000
const NORMAL_CLOSE = 1000

// 'pcm_16000' -> 16000. Anything else (mp3_*, ulaw_8000) returns null and we
// keep the audio.js default, because this module only knows how to play PCM16.
function pcmRate(format) {
  const match = /^pcm_(\d+)$/.exec(String(format ?? ''))
  return match ? Number(match[1]) : null
}

// The Worker speaks the ElevenLabs *SDK* dialect (camelCase); the raw socket
// wants snake_case. Only the keys we actually get are mapped — the prompt text
// itself is passed through untouched.
function configOverride(overrides) {
  if (!overrides || typeof overrides !== 'object') return null
  const out = {}

  const agent = overrides.agent
  if (agent && typeof agent === 'object') {
    const next = {}
    if (agent.prompt && typeof agent.prompt === 'object') next.prompt = { ...agent.prompt }
    else if (typeof agent.prompt === 'string') next.prompt = { prompt: agent.prompt }

    const first = agent.firstMessage ?? agent.first_message
    if (typeof first === 'string' && first.trim()) next.first_message = first
    if (typeof agent.language === 'string') next.language = agent.language
    if (Object.keys(next).length) out.agent = next
  }

  const tts = overrides.tts
  if (tts && typeof tts === 'object') {
    const voiceId = tts.voiceId ?? tts.voice_id
    const next = {}
    if (typeof voiceId === 'string') next.voice_id = voiceId
    if (typeof tts.stability === 'number') next.stability = tts.stability
    if (typeof tts.speed === 'number') next.speed = tts.speed
    if (Object.keys(next).length) out.tts = next
  }

  return Object.keys(out).length ? out : null
}

export function createElevenLabsSession({
  signedUrl = null,
  overrides = null,
  dynamicVariables = null,
  onState = null,
  onAgentText = null,
  onUserText = null,
  onSpeakingChange = null,
  onTurn = null,
  onError = null,
  onEnded = null, // the agent ended the conversation; not called when we disconnect
  socketFactory = null, // lets a test stand a mock in for WebSocket
  refreshSignedUrl = null, // optional async () => url, for reconnects after expiry
} = {}) {
  const turns = []
  const mic = createMicCapture({ sampleRate: MIC_SAMPLE_RATE, onAudio: sendMicAudio })

  let playback = null // built lazily: the negotiated rate decides its AudioContext rate
  let socket = null
  let state = 'closed' // connecting | open | reconnecting | closed
  let attempt = 0
  let retryTimer = null
  let stopped = false
  let initialized = false
  let muted = false
  let conversationId = null
  let inputRate = MIC_SAMPLE_RATE
  let outputRate = PLAYBACK_SAMPLE_RATE
  let pendingQuestion = ''
  let pendingAnswer = ''

  function setState(next) {
    if (state === next) return
    state = next
    onState?.(state)
  }

  function fail(reason, message) {
    onError?.({ reason, message })
    return { ok: false, reason, message }
  }

  function send(payload) {
    if (!socket || socket.readyState !== 1) return false
    try {
      socket.send(JSON.stringify(payload))
    } catch {
      return false
    }
    return true
  }

  function ensurePlayback() {
    if (!playback) {
      playback = createPlaybackQueue({
        sampleRate: outputRate,
        onPlayingChange: (playing) => onSpeakingChange?.(playing),
      })
    }
    return playback
  }

  // ── turn pairing ──────────────────────────────────────────────────────────
  // One turn = everything the agent said, then everything the candidate said in
  // reply. The pair is only closed when the agent speaks again, because that is
  // the first moment we know the answer is finished — ElevenLabs can split a
  // long answer across several user_transcript events.

  function flushTurn() {
    if (!pendingAnswer) return null
    const turn = { question: pendingQuestion.trim(), answer: pendingAnswer.trim() }
    pendingQuestion = ''
    pendingAnswer = ''
    turns.push(turn)
    onTurn?.(turn)
    return turn
  }

  function agentSaid(text) {
    if (typeof text !== 'string' || !text) return
    flushTurn()
    pendingQuestion = pendingQuestion ? `${pendingQuestion} ${text}` : text
    onAgentText?.(text)
  }

  function agentCorrected(original, corrected) {
    if (typeof corrected !== 'string' || !corrected) return
    if (original && pendingQuestion.endsWith(original)) {
      pendingQuestion = pendingQuestion.slice(0, -original.length) + corrected
    } else {
      pendingQuestion = corrected
    }
    onAgentText?.(corrected)
  }

  function userSaid(text, isFinal = true) {
    if (typeof text !== 'string' || !text) return
    onUserText?.(text, isFinal)
    if (!isFinal) return
    pendingAnswer = pendingAnswer ? `${pendingAnswer} ${text}` : text
  }

  // ── protocol ──────────────────────────────────────────────────────────────

  function initPayload() {
    const override = configOverride(overrides)
    return {
      type: 'conversation_initiation_client_data',
      ...(override ? { conversation_config_override: override } : {}),
      ...(dynamicVariables ? { dynamic_variables: dynamicVariables } : {}),
    }
  }

  function handleMessage(message, onReady) {
    switch (message.type) {
      case 'conversation_initiation_metadata': {
        const meta = message.conversation_initiation_metadata_event ?? {}
        conversationId = meta.conversation_id ?? conversationId
        inputRate = pcmRate(meta.user_input_audio_format) ?? MIC_SAMPLE_RATE
        outputRate = pcmRate(meta.agent_output_audio_format) ?? PLAYBACK_SAMPLE_RATE
        if (meta.agent_output_audio_format && !pcmRate(meta.agent_output_audio_format)) {
          fail('audio-format', `The agent is sending ${meta.agent_output_audio_format}; this client can only play PCM16.`)
        }
        initialized = true
        attempt = 0
        setState('open')
        // Resumed here rather than lazily on the first chunk: this still runs
        // inside the gesture that called connect(), so autoplay policy lets it.
        ensurePlayback().resume()?.catch?.(() => {})
        mic.setEnabled(!muted)
        onReady?.({ ok: true, conversationId })
        return
      }

      case 'ping': {
        // Miss this and ElevenLabs drops the socket mid-interview.
        const id = message.ping_event?.event_id
        send({ type: 'pong', event_id: id })
        return
      }

      case 'audio': {
        const event = message.audio_event ?? {}
        const base64 = event.audio_base_64 ?? event.audio_base64
        if (base64) ensurePlayback().push(bytesToPcm16(fromBase64(base64)))
        return
      }

      case 'agent_response':
        agentSaid(message.agent_response_event?.agent_response)
        return

      case 'agent_response_correction':
        agentCorrected(
          message.agent_response_correction_event?.original_agent_response,
          message.agent_response_correction_event?.corrected_agent_response,
        )
        return

      case 'user_transcript':
        userSaid(message.user_transcription_event?.user_transcript, true)
        return

      case 'interruption':
        // Barge-in: the agent has stopped generating, so anything still queued
        // would be speech the candidate already talked over.
        playback?.clear()
        return

      default:
        // vad_score, agent_response_metadata, tool calls, queue_status — all
        // safe to ignore, and ignoring unknown types keeps us forward compatible.
        return
    }
  }

  function decode(data) {
    if (typeof data === 'string') return JSON.parse(data)
    if (data instanceof ArrayBuffer) return JSON.parse(new TextDecoder().decode(data))
    return null
  }

  function sendMicAudio(pcm16) {
    if (!initialized || muted) return
    const atRate =
      inputRate === MIC_SAMPLE_RATE
        ? pcm16
        : float32ToPcm16(resample(pcm16ToFloat32(pcm16), MIC_SAMPLE_RATE, inputRate))
    // No `type` field on this one — the protocol defines the bare key.
    send({ user_audio_chunk: toBase64(atRate) })
  }

  function openSocket() {
    return new Promise((resolve) => {
      if (typeof WebSocket === 'undefined' && !socketFactory) {
        resolve({ ok: false, reason: 'unsupported', message: 'This browser has no WebSocket support.' })
        return
      }

      let settled = false
      let timer = null
      const done = (result) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(result)
      }

      let ws
      try {
        ws = socketFactory ? socketFactory(signedUrl) : new WebSocket(signedUrl)
      } catch (err) {
        done({ ok: false, reason: 'socket', message: err?.message ?? 'Could not open the interviewer socket.' })
        return
      }

      // ArrayBuffer rather than Blob so decoding stays synchronous, which is
      // what keeps streamed audio chunks in the order they arrived.
      ws.binaryType = 'arraybuffer'
      socket = ws

      timer = setTimeout(
        () => done({ ok: false, reason: 'timeout', message: 'The interviewer did not finish the handshake.' }),
        INIT_TIMEOUT_MS,
      )

      ws.onopen = () => {
        try {
          ws.send(JSON.stringify(initPayload()))
        } catch {
          // onclose follows and runs the normal reconnect path
        }
      }

      ws.onmessage = (event) => {
        let message
        try {
          message = decode(event.data)
        } catch {
          return // an unparseable frame is never fatal
        }
        if (message) handleMessage(message, done)
      }

      ws.onerror = () => {} // onclose always follows and carries the code

      ws.onclose = (event) => {
        done({
          ok: false,
          reason: 'closed',
          message: `The interviewer closed the connection (${event?.code ?? 0}${event?.reason ? `: ${event.reason}` : ''}).`,
        })
        handleClose(event)
      }
    })
  }

  function handleClose(event) {
    const wasLive = initialized
    socket = null
    initialized = false
    mic.setEnabled(false)
    if (stopped) return

    // 1000 is the agent hanging up (goodbye, max duration, silence). Redialing would open a new
    // billed conversation that starts the interview over, and that one would hang up and redial too.
    if (wasLive && event?.code === NORMAL_CLOSE) {
      stopped = true
      flushTurn()
      setState('closed')
      onEnded?.()
      return
    }

    if (attempt >= BACKOFF_MS.length) {
      setState('closed')
      fail('disconnected', `Lost the connection to the interviewer (${event?.code ?? 0}).`)
      return
    }

    const delay = BACKOFF_MS[attempt++]
    setState('reconnecting')
    retryTimer = setTimeout(async () => {
      retryTimer = null
      if (stopped) return
      if (refreshSignedUrl) {
        // A signed URL is short lived, so a reconnect may need a fresh one.
        try {
          const next = await refreshSignedUrl()
          if (typeof next === 'string' && next) signedUrl = next
        } catch {
          // fall through and retry with the URL we have
        }
      }
      if (stopped) return
      // A failed attempt closes again, which lands back here with a longer delay.
      await openSocket()
    }, delay)
  }

  async function connect() {
    if (!signedUrl) return fail('missing-url', 'No signed URL. Call POST /api/voice/sessions first.')

    stopped = false
    attempt = 0
    setState('connecting')

    // Prompt for the mic while the handshake is in flight; nothing is sent until
    // setEnabled(true) after the metadata arrives.
    const micStarting = mic.start()
    const result = await openSocket()
    const micReady = await micStarting

    if (!result.ok) {
      if (state !== 'reconnecting') setState('closed')
      if (state === 'closed') onError?.({ reason: result.reason, message: result.message })
      return result
    }

    // Denial is a state the interview continues in (typed answers), never a throw.
    if (!micReady.ok) {
      onError?.({ reason: micReady.reason, message: micReady.message })
      return { ok: true, conversationId, mic: micReady }
    }

    mic.setEnabled(!muted)
    return { ok: true, conversationId }
  }

  // Mic-denied fallback: a typed answer has to reach the agent the same way a
  // spoken one would, and count as the candidate's half of the turn.
  function sendUserText(text) {
    if (typeof text !== 'string' || !text.trim()) return false
    const sent = send({ type: 'user_message', text })
    userSaid(text, true)
    return sent
  }

  function interrupt() {
    playback?.clear()
    send({ type: 'user_activity' })
  }

  async function disconnect() {
    stopped = true
    clearTimeout(retryTimer)
    retryTimer = null
    flushTurn() // the last answer must not die with the socket
    mic.setEnabled(false)
    mic.stop()
    try {
      socket?.close(1000, 'interview finished')
    } catch {
      // already closing
    }
    socket = null
    initialized = false
    const closing = playback
    playback = null
    await closing?.close()
    setState('closed')
  }

  return {
    get state() {
      return state
    },
    get micDenied() {
      return mic.denied
    },
    get micState() {
      return mic.state
    },
    get conversationId() {
      return conversationId
    },
    // Survives reconnects: turns are appended here the moment they are emitted.
    get turns() {
      return turns.slice()
    },
    get audioFormat() {
      return { inputRate, outputRate }
    },
    get analyser() {
      return playback?.analyser ?? null
    },

    connect,
    disconnect,
    sendUserText,
    interrupt,

    isSpeaking: () => playback?.isPlaying() ?? false,
    // null until the handshake builds the playback context, which is lipSync.js's
    // signal to fall back to the procedural envelope.
    getAmplitude: () => playback?.getAmplitude() ?? null,

    setMuted(next) {
      muted = Boolean(next)
      // Gate the mic too: a live agent left listening to a room nobody is
      // attending keeps talking and keeps burning quota.
      mic.setEnabled(!muted && initialized)
      playback?.setMuted(muted)
      if (muted) playback?.clear()
      return muted
    },
  }
}
