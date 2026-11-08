import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toBase64 } from './audio.js'
import { createElevenLabsSession } from './elevenlabs.js'

// Everything here runs against a mock socket and a mock AudioContext. No frame
// is ever exchanged with the real service: reaching it needs a fresh signed URL
// and spends the team's quota, so the protocol shapes asserted below come from
// the ElevenLabs docs, not from a live capture.

const SIGNED_URL = 'wss://api.elevenlabs.io/v1/convai/conversation?agent_id=agent_06'

const OVERRIDES = {
  agent: {
    prompt: { prompt: 'You are an interviewer. Ask: 1. Tell me about yourself.' },
    firstMessage: 'Thanks for coming in.',
  },
}

// ── mock socket ─────────────────────────────────────────────────────────────

function createMockSocket(url) {
  const socket = {
    url,
    readyState: 0,
    binaryType: null,
    sent: [],
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null,
    send(data) {
      socket.sent.push(data)
    },
    close(code = 1000, reason = '') {
      socket.readyState = 3
      socket.onclose?.({ code, reason })
    },
    open() {
      socket.readyState = 1
      socket.onopen?.()
    },
    emit(message) {
      socket.onmessage?.({ data: JSON.stringify(message) })
    },
    emitRaw(data) {
      socket.onmessage?.({ data })
    },
    drop(code = 1006) {
      socket.readyState = 3
      socket.onclose?.({ code })
    },
    messages() {
      return socket.sent.map((text) => JSON.parse(text))
    },
    typed(type) {
      return socket.messages().filter((m) => m.type === type)
    },
    audioChunks() {
      return socket.messages().filter((m) => typeof m.user_audio_chunk === 'string')
    },
  }
  return socket
}

function socketTracker() {
  const sockets = []
  const factory = (url) => {
    const socket = createMockSocket(url)
    sockets.push(socket)
    return socket
  }
  factory.sockets = sockets
  factory.last = () => sockets[sockets.length - 1]
  return factory
}

// ── mock Web Audio ──────────────────────────────────────────────────────────

class MockAudioContext {
  constructor(options) {
    this.sampleRate = options?.sampleRate ?? 48000
    this.state = 'running'
    this.currentTime = 0
    this.destination = {}
    this.role = null // 'playback' once an analyser is asked for, 'mic' for a processor
    this.played = [] // every buffer that actually started
    this.sources = []
    this.processor = null
    this.closed = false
    MockAudioContext.instances.push(this)
  }

  createAnalyser() {
    this.role = 'playback'
    return {
      fftSize: 0,
      smoothingTimeConstant: 0,
      frequencyBinCount: 8,
      connect() {},
      disconnect() {},
      getByteTimeDomainData(bins) {
        bins.fill(128) // silence, so getAmplitude() returns 0 rather than null
      },
    }
  }

  createGain() {
    return { gain: { value: 1 }, connect() {}, disconnect() {} }
  }

  createBuffer(channels, length, sampleRate) {
    const data = new Float32Array(length)
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      duration: length / sampleRate,
      copyToChannel(source) {
        data.set(source)
      },
      getChannelData: () => data,
    }
  }

  createBufferSource() {
    const ctx = this
    const source = {
      buffer: null,
      startedAt: null,
      stopped: false,
      onended: null,
      connect() {},
      disconnect() {},
      start(at) {
        source.startedAt = at
        ctx.played.push(source.buffer)
      },
      stop() {
        source.stopped = true
      },
    }
    this.sources.push(source)
    return source
  }

  // No `audioWorklet` property on purpose: audio.js then takes its
  // ScriptProcessor fallback, which a test can drive by hand.
  createScriptProcessor() {
    this.role = 'mic'
    const node = { onaudioprocess: null, connect() {}, disconnect() {} }
    this.processor = node
    return node
  }

  createMediaStreamSource() {
    return { connect() {}, disconnect() {} }
  }

  resume() {
    this.state = 'running'
    return Promise.resolve()
  }

  close() {
    this.closed = true
    return Promise.resolve()
  }
}
MockAudioContext.instances = []

const ctxOf = (role) => MockAudioContext.instances.find((ctx) => ctx.role === role)

let micError = null
let stoppedTracks = 0

function installAudioGlobals() {
  MockAudioContext.instances = []
  micError = null
  stoppedTracks = 0
  globalThis.window = { AudioContext: MockAudioContext }
  const navigatorStub = {
    mediaDevices: {
      getUserMedia: () =>
        micError
          ? Promise.reject(micError)
          : Promise.resolve({ getTracks: () => [{ stop: () => (stoppedTracks += 1) }] }),
    },
  }
  try {
    Object.defineProperty(globalThis, 'navigator', {
      value: navigatorStub,
      configurable: true,
      writable: true,
    })
  } catch {
    globalThis.navigator = navigatorStub
  }
}

beforeEach(installAudioGlobals)

afterEach(() => {
  vi.useRealTimers()
  delete globalThis.window
})

// ── helpers ─────────────────────────────────────────────────────────────────

const metadata = (over = {}) => ({
  type: 'conversation_initiation_metadata',
  conversation_initiation_metadata_event: {
    conversation_id: 'conv_1',
    agent_output_audio_format: 'pcm_24000',
    user_input_audio_format: 'pcm_16000',
    ...over,
  },
})

const audioEvent = (samples, eventId = 1) => ({
  type: 'audio',
  audio_event: { audio_base_64: toBase64(new Int16Array(samples)), event_id: eventId },
})

const agentSays = (text) => ({ type: 'agent_response', agent_response_event: { agent_response: text } })
const userSays = (text) => ({ type: 'user_transcript', user_transcription_event: { user_transcript: text } })

async function connected(options = {}, meta = {}) {
  const factory = options.socketFactory ?? socketTracker()
  const voice = createElevenLabsSession({
    signedUrl: SIGNED_URL,
    overrides: OVERRIDES,
    ...options,
    socketFactory: factory,
  })
  const connecting = voice.connect()
  const ws = factory.last()
  ws.open()
  ws.emit(metadata(meta))
  const result = await connecting
  return { voice, ws, factory, result }
}

function driveMic(frames = 320) {
  const ctx = ctxOf('mic')
  const samples = new Float32Array(frames).fill(0.5)
  ctx.processor.onaudioprocess({ inputBuffer: { getChannelData: () => samples } })
}

// ── init handshake ──────────────────────────────────────────────────────────

describe('conversation_initiation_client_data', () => {
  it('is the first frame sent, and carries the overrides the server composed', async () => {
    const { ws } = await connected()
    const init = ws.messages()[0]

    expect(init.type).toBe('conversation_initiation_client_data')
    expect(init.conversation_config_override.agent.prompt.prompt).toBe(OVERRIDES.agent.prompt.prompt)
  })

  it('renames firstMessage to the protocol first_message', async () => {
    const { ws } = await connected()
    expect(ws.messages()[0].conversation_config_override.agent.first_message).toBe('Thanks for coming in.')
  })

  // Sending first_message at all is rejected with close 1008 when the agent's
  // config forbids that override — and an empty string still counts as sending it.
  it('drops an empty first message, which the service rejects as an override', async () => {
    const { ws } = await connected({ overrides: { agent: { prompt: { prompt: 'p' }, firstMessage: '' } } })
    const agent = ws.messages()[0].conversation_config_override.agent
    expect(agent).not.toHaveProperty('first_message')
    expect(agent.prompt.prompt).toBe('p')
  })

  it('maps language and tts.voiceId', async () => {
    const { ws } = await connected({
      overrides: { agent: { language: 'en' }, tts: { voiceId: 'voice_1' } },
    })
    const override = ws.messages()[0].conversation_config_override
    expect(override.agent.language).toBe('en')
    expect(override.tts.voice_id).toBe('voice_1')
  })

  it('omits the override entirely when the server sent none', async () => {
    const { ws } = await connected({ overrides: null })
    expect(ws.messages()[0]).toEqual({ type: 'conversation_initiation_client_data' })
  })

  it('opens the socket at the signed URL and asks for arraybuffer frames', async () => {
    const { ws } = await connected()
    expect(ws.url).toBe(SIGNED_URL)
    expect(ws.binaryType).toBe('arraybuffer')
  })

  it('reports state connecting then open, and exposes the conversation id', async () => {
    const onState = vi.fn()
    const { voice } = await connected({ onState })

    expect(onState.mock.calls.map(([s]) => s)).toEqual(['connecting', 'open'])
    expect(voice.state).toBe('open')
    expect(voice.conversationId).toBe('conv_1')
  })

  it('fails without throwing when there is no signed URL', async () => {
    const onError = vi.fn()
    const voice = createElevenLabsSession({ signedUrl: null, onError, socketFactory: socketTracker() })
    const result = await voice.connect()

    expect(result).toMatchObject({ ok: false, reason: 'missing-url' })
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ reason: 'missing-url' }))
  })
})

// ── negotiated audio formats ────────────────────────────────────────────────

describe('audio format negotiation', () => {
  it('takes both rates from the metadata rather than hardcoding them', async () => {
    const { voice } = await connected({}, { agent_output_audio_format: 'pcm_44100', user_input_audio_format: 'pcm_8000' })
    expect(voice.audioFormat).toEqual({ inputRate: 8000, outputRate: 44100 })
  })

  it('builds the playback context at the negotiated output rate', async () => {
    const { ws } = await connected({}, { agent_output_audio_format: 'pcm_16000' })
    ws.emit(audioEvent([1, 2, 3, 4]))
    expect(ctxOf('playback').sampleRate).toBe(16000)
  })

  it('falls back to the audio.js constants when the server states no format', async () => {
    const { voice } = await connected({}, { agent_output_audio_format: undefined, user_input_audio_format: undefined })
    expect(voice.audioFormat).toEqual({ inputRate: 16000, outputRate: 24000 })
  })

  it('reports a format it cannot play instead of silently garbling it', async () => {
    const onError = vi.fn()
    const { voice } = await connected({ onError }, { agent_output_audio_format: 'mp3_44100_128' })

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ reason: 'audio-format' }))
    expect(voice.audioFormat.outputRate).toBe(24000)
  })
})

// ── inbound events ──────────────────────────────────────────────────────────

describe('inbound events', () => {
  it('answers ping with a pong carrying the same event_id', async () => {
    const { ws } = await connected()
    ws.emit({ type: 'ping', ping_event: { event_id: 42, ping_ms: 8 } })

    expect(ws.typed('pong')).toEqual([{ type: 'pong', event_id: 42 }])
  })

  it('decodes an audio chunk into the playback queue', async () => {
    const { ws, voice } = await connected()
    ws.emit(audioEvent([0, 16384, -16384, 32767]))

    const played = ctxOf('playback').played
    expect(played).toHaveLength(1)
    expect(played[0].length).toBe(4)
    expect(Array.from(played[0].getChannelData())).toEqual([0, 0.5, -0.5, 32767 / 32768])
    expect(voice.isSpeaking()).toBe(true)
  })

  it('drives onSpeakingChange from the playback queue, not from the event', async () => {
    const onSpeakingChange = vi.fn()
    const { ws } = await connected({ onSpeakingChange })

    expect(onSpeakingChange).not.toHaveBeenCalled()
    ws.emit(audioEvent([1, 2]))
    expect(onSpeakingChange).toHaveBeenCalledWith(true)
  })

  it('exposes a playback amplitude from the analyser, and null before one exists', async () => {
    const voice = createElevenLabsSession({ signedUrl: SIGNED_URL, socketFactory: socketTracker() })
    expect(voice.getAmplitude()).toBe(null)
    expect(voice.analyser).toBe(null)

    const live = await connected()
    live.ws.emit(audioEvent([1, 2]))
    expect(live.voice.getAmplitude()).toBe(0) // the mock analyser reports silence
    expect(live.voice.analyser).not.toBe(null)
  })

  it('clears the queue on interruption', async () => {
    const { ws, voice } = await connected()
    ws.emit(audioEvent([1, 2]))
    ws.emit(audioEvent([3, 4]))
    ws.emit({ type: 'interruption', interruption_event: { reason: 'agent_interrupted' } })

    expect(ctxOf('playback').sources.every((s) => s.stopped)).toBe(true)
    expect(voice.isSpeaking()).toBe(false)
  })

  it('reports agent and user text to the caption callbacks', async () => {
    const onAgentText = vi.fn()
    const onUserText = vi.fn()
    const { ws } = await connected({ onAgentText, onUserText })

    ws.emit(agentSays('Tell me about yourself.'))
    ws.emit(userSays('I build things.'))

    expect(onAgentText).toHaveBeenCalledWith('Tell me about yourself.')
    expect(onUserText).toHaveBeenCalledWith('I build things.', true)
  })

  it('ignores event types it does not know and frames it cannot parse', async () => {
    const onError = vi.fn()
    const { ws, voice } = await connected({ onError })

    ws.emit({ type: 'vad_score', vad_score_event: { vad_score: 0.9 } })
    ws.emit({ type: 'agent_response_metadata' })
    ws.emitRaw('not json')
    ws.emitRaw(null)

    expect(voice.state).toBe('open')
    expect(onError).not.toHaveBeenCalled()
  })

  it('applies agent_response_correction to the pending question', async () => {
    const onAgentText = vi.fn()
    const onTurn = vi.fn()
    const { ws } = await connected({ onAgentText, onTurn })

    ws.emit(agentSays('Tell me about a time you failed and'))
    ws.emit({
      type: 'agent_response_correction',
      agent_response_correction_event: {
        original_agent_response: 'Tell me about a time you failed and',
        corrected_agent_response: 'Tell me about a time you failed.',
      },
    })
    ws.emit(userSays('I shipped a bad migration.'))
    ws.emit(agentSays('Thanks.'))

    expect(onAgentText).toHaveBeenCalledWith('Tell me about a time you failed.')
    expect(onTurn).toHaveBeenCalledWith({
      question: 'Tell me about a time you failed.',
      answer: 'I shipped a bad migration.',
    })
  })
})

// ── turn pairing ────────────────────────────────────────────────────────────

describe('turn pairing', () => {
  it('closes a pair when the agent speaks again, not when the answer arrives', async () => {
    const onTurn = vi.fn()
    const { ws, voice } = await connected({ onTurn })

    ws.emit(agentSays('Q1'))
    ws.emit(userSays('A1'))
    expect(onTurn).not.toHaveBeenCalled()

    ws.emit(agentSays('Q2'))
    expect(onTurn).toHaveBeenCalledTimes(1)
    expect(onTurn).toHaveBeenCalledWith({ question: 'Q1', answer: 'A1' })
    expect(voice.turns).toEqual([{ question: 'Q1', answer: 'A1' }])
  })

  it('joins a segmented answer into one turn', async () => {
    const onTurn = vi.fn()
    const { ws } = await connected({ onTurn })

    ws.emit(agentSays('Q1'))
    ws.emit(userSays('I led the migration.'))
    ws.emit(userSays('It took three weeks.'))
    ws.emit(agentSays('Q2'))

    expect(onTurn).toHaveBeenCalledTimes(1)
    expect(onTurn).toHaveBeenCalledWith({
      question: 'Q1',
      answer: 'I led the migration. It took three weeks.',
    })
  })

  it('joins an acknowledgement and the next question into one question', async () => {
    const onTurn = vi.fn()
    const { ws } = await connected({ onTurn })

    ws.emit(agentSays('Q1'))
    ws.emit(userSays('A1'))
    ws.emit(agentSays('Good.'))
    ws.emit(agentSays('Q2'))
    ws.emit(userSays('A2'))
    ws.emit(agentSays('Q3'))

    expect(onTurn.mock.calls.map(([t]) => t)).toEqual([
      { question: 'Q1', answer: 'A1' },
      { question: 'Good. Q2', answer: 'A2' },
    ])
  })

  it('never emits a question with no answer', async () => {
    const onTurn = vi.fn()
    const { voice, ws } = await connected({ onTurn })

    ws.emit(agentSays('Q1'))
    ws.emit(agentSays('Q2'))
    await voice.disconnect()

    expect(onTurn).not.toHaveBeenCalled()
    expect(voice.turns).toEqual([])
  })

  it('pairs an unprompted answer with an empty question rather than dropping it', async () => {
    const onTurn = vi.fn()
    const { ws, voice } = await connected({ onTurn })

    ws.emit(userSays('I am ready.'))
    await voice.disconnect()

    expect(onTurn).toHaveBeenCalledWith({ question: '', answer: 'I am ready.' })
  })

  it('flushes the final pair on disconnect so the last answer is still scored', async () => {
    const onTurn = vi.fn()
    const { ws, voice } = await connected({ onTurn })

    ws.emit(agentSays('Last question?'))
    ws.emit(userSays('Last answer.'))
    await voice.disconnect()

    expect(onTurn).toHaveBeenCalledWith({ question: 'Last question?', answer: 'Last answer.' })
    expect(voice.turns).toHaveLength(1)
  })

  it('counts a typed answer as the candidate half of the turn', async () => {
    const onTurn = vi.fn()
    const onUserText = vi.fn()
    const { ws, voice } = await connected({ onTurn, onUserText })

    ws.emit(agentSays('Q1'))
    expect(voice.sendUserText('typed answer')).toBe(true)
    ws.emit(agentSays('Q2'))

    expect(ws.typed('user_message')).toEqual([{ type: 'user_message', text: 'typed answer' }])
    expect(onUserText).toHaveBeenCalledWith('typed answer', true)
    expect(onTurn).toHaveBeenCalledWith({ question: 'Q1', answer: 'typed answer' })
  })
})

// ── outbound microphone audio ───────────────────────────────────────────────

describe('microphone', () => {
  it('sends captured audio as a bare user_audio_chunk', async () => {
    const { ws } = await connected()
    driveMic(320)

    const chunks = ws.audioChunks()
    expect(chunks).toHaveLength(1)
    expect(Object.keys(chunks[0])).toEqual(['user_audio_chunk'])
    expect(atob(chunks[0].user_audio_chunk).length).toBe(640) // 320 PCM16 samples
  })

  it('resamples to the negotiated input rate', async () => {
    const { ws } = await connected({}, { user_input_audio_format: 'pcm_8000' })
    driveMic(320)

    expect(atob(ws.audioChunks()[0].user_audio_chunk).length).toBe(320) // 160 samples at 8 kHz
  })

  it('sends nothing while the socket is down', async () => {
    const { ws } = await connected()
    vi.useFakeTimers()
    ws.drop()
    driveMic(320)

    expect(ws.audioChunks()).toHaveLength(0)
  })

  it('stops sending while muted and resumes after', async () => {
    const { ws, voice } = await connected()

    voice.setMuted(true)
    driveMic(320)
    expect(ws.audioChunks()).toHaveLength(0)

    voice.setMuted(false)
    driveMic(320)
    expect(ws.audioChunks()).toHaveLength(1)
  })

  it('reports a denied microphone as a flag instead of throwing', async () => {
    const onError = vi.fn()
    micError = Object.assign(new Error('nope'), { name: 'NotAllowedError' })

    const { voice, result } = await connected({ onError })

    expect(result.ok).toBe(true) // the interview continues with typed answers
    expect(voice.micDenied).toBe(true)
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ reason: 'denied' }))
  })

  it('releases the microphone on disconnect', async () => {
    const { voice } = await connected()
    await voice.disconnect()
    expect(stoppedTracks).toBe(1)
  })
})

// ── interrupt and teardown ──────────────────────────────────────────────────

describe('interrupt and teardown', () => {
  it('interrupt clears playback and tells the agent the user is active', async () => {
    const { ws, voice } = await connected()
    ws.emit(audioEvent([1, 2]))
    voice.interrupt()

    expect(ctxOf('playback').sources.every((s) => s.stopped)).toBe(true)
    expect(ws.typed('user_activity')).toEqual([{ type: 'user_activity' }])
  })

  it('disconnect closes cleanly and reports closed once', async () => {
    const onState = vi.fn()
    const { ws, voice } = await connected({ onState })
    await voice.disconnect()

    expect(ws.readyState).toBe(3)
    expect(voice.state).toBe('closed')
    expect(onState.mock.calls.map(([s]) => s)).toEqual(['connecting', 'open', 'closed'])
  })
})

// ── reconnect ───────────────────────────────────────────────────────────────

describe('reconnect', () => {
  it('treats a clean close from the agent as the end of the interview, never dialing a new conversation', async () => {
    const onTurn = vi.fn()
    const onEnded = vi.fn()
    const factory = socketTracker()
    const { ws, voice } = await connected({ onTurn, onEnded, socketFactory: factory })

    ws.emit(agentSays('Q1'))
    ws.emit(userSays('A1'))
    vi.useFakeTimers()
    ws.drop(1000)
    await vi.advanceTimersByTimeAsync(5000)

    expect(factory.sockets).toHaveLength(1)
    expect(voice.state).toBe('closed')
    expect(onTurn).toHaveBeenCalledWith({ question: 'Q1', answer: 'A1' })
    expect(onEnded).toHaveBeenCalledTimes(1)
  })

  it('does not report an ending when we hung up ourselves', async () => {
    const onEnded = vi.fn()
    const { voice } = await connected({ onEnded })
    await voice.disconnect()
    expect(onEnded).not.toHaveBeenCalled()
  })

  it('reconnects with backoff and keeps the turns it already emitted', async () => {
    const onTurn = vi.fn()
    const factory = socketTracker()
    const { ws, voice } = await connected({ onTurn, socketFactory: factory })

    ws.emit(agentSays('Q1'))
    ws.emit(userSays('A1'))
    ws.emit(agentSays('Q2'))
    expect(onTurn).toHaveBeenCalledTimes(1)

    vi.useFakeTimers()
    ws.drop(1006)
    expect(voice.state).toBe('reconnecting')
    expect(factory.sockets).toHaveLength(1) // nothing opened yet: backoff first

    await vi.advanceTimersByTimeAsync(600)
    expect(factory.sockets).toHaveLength(2)

    const next = factory.last()
    next.open()
    next.emit(metadata())
    expect(voice.state).toBe('open')
    expect(next.messages()[0].type).toBe('conversation_initiation_client_data')

    expect(onTurn).toHaveBeenCalledTimes(1)
    expect(voice.turns).toEqual([{ question: 'Q1', answer: 'A1' }])
  })

  it('keeps the half-finished pair across a drop and emits it once', async () => {
    const onTurn = vi.fn()
    const factory = socketTracker()
    const { ws, voice } = await connected({ onTurn, socketFactory: factory })

    ws.emit(agentSays('Q1'))
    ws.emit(userSays('A1'))

    vi.useFakeTimers()
    ws.drop(1006)
    await vi.advanceTimersByTimeAsync(600)

    const next = factory.last()
    next.open()
    next.emit(metadata())
    next.emit(agentSays('Q2'))

    expect(onTurn).toHaveBeenCalledTimes(1)
    expect(onTurn).toHaveBeenCalledWith({ question: 'Q1', answer: 'A1' })
  })

  it('asks for a fresh signed URL before each retry when given one', async () => {
    const factory = socketTracker()
    const refreshSignedUrl = vi.fn(async () => `${SIGNED_URL}&retry=1`)
    const { ws } = await connected({ refreshSignedUrl, socketFactory: factory })

    vi.useFakeTimers()
    ws.drop(1006)
    await vi.advanceTimersByTimeAsync(600)

    expect(refreshSignedUrl).toHaveBeenCalledTimes(1)
    expect(factory.last().url).toBe(`${SIGNED_URL}&retry=1`)
  })

  it('gives up after three attempts with state closed and an error', async () => {
    const onError = vi.fn()
    const onState = vi.fn()
    const factory = socketTracker()
    const { ws, voice } = await connected({ onError, onState, socketFactory: factory })

    vi.useFakeTimers()
    ws.drop(1006)
    for (const delay of [500, 1200, 2500]) {
      await vi.advanceTimersByTimeAsync(delay + 10)
      factory.last().drop(1006)
    }

    expect(factory.sockets).toHaveLength(4) // the first plus three retries
    expect(voice.state).toBe('closed')
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ reason: 'disconnected' }))
    expect(onState.mock.calls.map(([s]) => s)).toEqual(['connecting', 'open', 'reconnecting', 'closed'])
  })

  it('does not reconnect after an intentional disconnect', async () => {
    const factory = socketTracker()
    const { voice } = await connected({ socketFactory: factory })

    vi.useFakeTimers()
    await voice.disconnect()
    await vi.advanceTimersByTimeAsync(5000)

    expect(factory.sockets).toHaveLength(1)
    expect(voice.state).toBe('closed')
  })
})
