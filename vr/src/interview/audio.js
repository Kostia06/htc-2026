// Web Audio plumbing for the Gemini Live voice loop. Nothing in here knows the
// Gemini protocol — that lives in geminiLive.js. This file only does: mic in as
// PCM16 mono at 16 kHz, model audio out at 24 kHz, and an AnalyserNode on the
// playback side so the avatar's lip sync can read real speech energy instead of
// the procedural envelope.

import { connectToSpeakers } from './spatialAudio.js'

export const MIC_SAMPLE_RATE = 16000
export const PLAYBACK_SAMPLE_RATE = 24000

const CAPTURE_PROCESSOR = 'pcm-capture'
const CAPTURE_CHUNK = 2048 // ~128 ms at 16 kHz: still feels live, but 16x fewer postMessages than a raw 128-frame
const FALLBACK_BUFFER = 4096
const SCHEDULE_LEAD = 0.08 // headroom so the next chunk is scheduled before the current one runs out
const AMPLITUDE_GAIN = 4 // matches speech.js, so lipSync.js stays tuned to the same 0..1 range

// Kept as a string and loaded from a Blob URL: an AudioWorklet needs its own
// module file, and this way the demo never fetches a second script over the
// network (and the folder stays two files).
const CAPTURE_SOURCE = `
class PcmCapture extends AudioWorkletProcessor {
  constructor(options) {
    super()
    this.size = options.processorOptions.chunkSize
    this.buffer = new Float32Array(this.size)
    this.offset = 0
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0]
    if (!channel) return true
    for (let i = 0; i < channel.length; i++) {
      this.buffer[this.offset++] = channel[i]
      if (this.offset === this.size) {
        // postMessage without a transfer list structured-clones the array, so
        // reusing this.buffer on the next frame is safe.
        this.port.postMessage(this.buffer)
        this.offset = 0
      }
    }
    return true
  }
}
registerProcessor('${CAPTURE_PROCESSOR}', PcmCapture)
`

const contextCtor = () =>
  typeof window === 'undefined' ? null : window.AudioContext || window.webkitAudioContext

export function float32ToPcm16(samples) {
  const out = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    out[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff
  }
  return out
}

export function pcm16ToFloat32(samples) {
  const out = new Float32Array(samples.length)
  for (let i = 0; i < samples.length; i++) out[i] = samples[i] / 32768
  return out
}

// Linear interpolation, no anti-alias filter. Only a safety net: the capture
// context is asked for 16 kHz up front, so usually fromRate === toRate and this
// returns immediately. For speech the aliasing it does introduce is inaudible.
export function resample(samples, fromRate, toRate) {
  if (fromRate === toRate || samples.length === 0) return samples
  const ratio = fromRate / toRate
  const length = Math.max(1, Math.round(samples.length / ratio))
  const out = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    const position = i * ratio
    const low = Math.floor(position)
    const high = Math.min(low + 1, samples.length - 1)
    const t = position - low
    out[i] = samples[low] * (1 - t) + samples[high] * t
  }
  return out
}

function asBytes(data) {
  if (data instanceof Uint8Array) return data
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
}

export function toBase64(data) {
  const bytes = asBytes(data)
  const CHUNK = 0x8000 // String.fromCharCode.apply blows the call stack past ~100k arguments
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

export function fromBase64(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

// Read with an explicit little-endian DataView rather than new Int16Array(buf):
// the base64 payload can land at an odd byte offset or an odd length, and the
// typed-array constructor throws on both.
export function bytesToPcm16(data) {
  const bytes = asBytes(data)
  const usable = bytes.byteLength - (bytes.byteLength % 2)
  const view = new DataView(bytes.buffer, bytes.byteOffset, usable)
  const out = new Int16Array(usable / 2)
  for (let i = 0; i < out.length; i++) out[i] = view.getInt16(i * 2, true)
  return out
}

// Raw PCM is not a mime type the scoring model accepts, so the 44-byte RIFF
// header is what makes a recorded answer usable by the Worker.
export function encodeWav(chunks, sampleRate = MIC_SAMPLE_RATE) {
  const total = chunks.reduce((n, chunk) => n + chunk.length, 0)
  const buffer = new ArrayBuffer(44 + total * 2)
  const view = new DataView(buffer)

  const ascii = (offset, text) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }

  ascii(0, 'RIFF')
  view.setUint32(4, 36 + total * 2, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // bytes per second
  view.setUint16(32, 2, true) // bytes per frame
  view.setUint16(34, 16, true) // bits per sample
  ascii(36, 'data')
  view.setUint32(40, total * 2, true)

  let offset = 44
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i++, offset += 2) view.setInt16(offset, chunk[i], true)
  }
  return buffer
}

// Microphone -> Int16Array chunks at `sampleRate`.
//
// start() never throws: a denied prompt comes back as { ok: false, reason:
// 'denied' } so the caller can offer typed answers instead.
export function createMicCapture({ sampleRate = MIC_SAMPLE_RATE, onAudio = null } = {}) {
  let ctx = null
  let stream = null
  let source = null
  let node = null
  let sink = null
  let workletUrl = null
  let starting = null
  let enabled = false
  let state = 'idle' // idle | running | denied | unsupported | error

  function deliver(frame) {
    if (!enabled || !onAudio || !ctx) return
    const at16k = resample(frame, ctx.sampleRate, sampleRate)
    onAudio(float32ToPcm16(at16k), sampleRate)
  }

  async function attach() {
    if (ctx.audioWorklet) {
      workletUrl = URL.createObjectURL(new Blob([CAPTURE_SOURCE], { type: 'application/javascript' }))
      await ctx.audioWorklet.addModule(workletUrl)
      node = new AudioWorkletNode(ctx, CAPTURE_PROCESSOR, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        processorOptions: { chunkSize: CAPTURE_CHUNK },
      })
      node.port.onmessage = (event) => deliver(event.data)
    } else {
      node = ctx.createScriptProcessor(FALLBACK_BUFFER, 1, 1)
      node.onaudioprocess = (event) => deliver(event.inputBuffer.getChannelData(0).slice())
    }

    // A node is only pulled if it reaches the destination, so route it through a
    // muted gain: without this some browsers never call process() at all, and
    // without the zero gain the headset would hear itself.
    sink = ctx.createGain()
    sink.gain.value = 0
    source = ctx.createMediaStreamSource(stream)
    source.connect(node)
    node.connect(sink)
    sink.connect(ctx.destination)
  }

  async function open() {
    const Ctor = contextCtor()
    if (!Ctor || !navigator?.mediaDevices?.getUserMedia) {
      state = 'unsupported'
      return { ok: false, reason: 'unsupported', message: 'This browser cannot capture microphone audio.' }
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
    } catch (err) {
      const denied = err?.name === 'NotAllowedError' || err?.name === 'SecurityError'
      state = denied ? 'denied' : 'error'
      return {
        ok: false,
        reason: state,
        message: denied
          ? 'Microphone permission was denied. You can type your answers instead.'
          : (err?.message ?? 'The microphone could not be opened.'),
        error: err,
      }
    }

    try {
      try {
        ctx = new Ctor({ sampleRate })
      } catch {
        // Some browsers reject a forced rate; resample() covers the difference.
        ctx = new Ctor()
      }
      if (ctx.state === 'suspended') await ctx.resume()
      await attach()
    } catch (err) {
      state = 'error'
      release()
      return { ok: false, reason: 'error', message: err?.message ?? 'Audio capture failed to start.', error: err }
    }

    state = 'running'
    return { ok: true }
  }

  function release() {
    enabled = false
    try {
      source?.disconnect()
      node?.disconnect()
      sink?.disconnect()
    } catch {
      // already torn down
    }
    if (node) {
      if (node.port) node.port.onmessage = null
      else node.onaudioprocess = null
    }
    stream?.getTracks().forEach((track) => track.stop())
    if (workletUrl) URL.revokeObjectURL(workletUrl)
    ctx?.close?.().catch?.(() => {})
    ctx = null
    stream = null
    source = null
    node = null
    sink = null
    workletUrl = null
  }

  return {
    get state() {
      return state
    },
    get denied() {
      return state === 'denied'
    },
    get enabled() {
      return enabled
    },
    get contextSampleRate() {
      return ctx?.sampleRate ?? null
    },

    start() {
      if (state === 'running') return Promise.resolve({ ok: true })
      if (!starting) {
        starting = open().finally(() => {
          starting = null
        })
      }
      return starting
    },

    // Gate the stream instead of reopening the mic for every answer: a second
    // getUserMedia on the Quest costs hundreds of milliseconds.
    setEnabled(next) {
      enabled = next && state === 'running'
      return enabled
    },

    stop() {
      release()
      if (state === 'running') state = 'idle'
    },
  }
}

// Plays streamed PCM16 chunks gaplessly and exposes the AnalyserNode they run
// through. This analyser is the whole reason the module exists: Interviewer.jsx
// calls getAmplitude() every frame to drive the visemes.
export function createPlaybackQueue({
  sampleRate = PLAYBACK_SAMPLE_RATE,
  onPlayingChange = null,
} = {}) {
  let ctx = null
  let analyser = null
  let output = null
  let nextStartAt = 0
  let active = 0
  let playing = false
  let generation = 0 // bumped by clear() so a stopped source's onended cannot decrement the new run
  const live = new Set()
  const drained = []

  function ensure() {
    if (ctx) return ctx
    const Ctor = contextCtor()
    if (!Ctor) return null
    try {
      ctx = new Ctor({ sampleRate })
    } catch {
      ctx = new Ctor()
    }
    analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.6
    output = ctx.createGain()
    analyser.connect(output)
    connectToSpeakers(ctx, output)
    return ctx
  }

  function setPlaying(next) {
    if (playing === next) return
    playing = next
    onPlayingChange?.(playing)
  }

  function settleDrained() {
    setPlaying(false)
    while (drained.length) drained.pop()()
  }

  return {
    get analyser() {
      return analyser
    },
    get sampleRate() {
      return sampleRate
    },

    async resume() {
      const audio = ensure()
      if (audio && audio.state === 'suspended') await audio.resume()
    },

    push(chunk) {
      const audio = ensure()
      if (!audio) return
      const samples = chunk instanceof Float32Array ? chunk : pcm16ToFloat32(chunk)
      if (!samples.length) return

      const buffer = audio.createBuffer(1, samples.length, sampleRate)
      buffer.copyToChannel(samples, 0)
      const source = audio.createBufferSource()
      source.buffer = buffer
      source.connect(analyser)

      const mine = generation
      const startAt = Math.max(audio.currentTime + SCHEDULE_LEAD, nextStartAt)
      nextStartAt = startAt + buffer.duration
      active += 1
      live.add(source)
      source.onended = () => {
        live.delete(source)
        if (mine !== generation) return
        active -= 1
        if (active === 0) settleDrained()
      }
      source.start(startAt)
      setPlaying(true)
    },

    isPlaying() {
      return playing
    },

    // Resolves once everything queued has finished sounding. Used to hold the
    // avatar's `speaking` flag for exactly as long as there is audio.
    whenDrained() {
      if (active === 0) return Promise.resolve()
      return new Promise((resolve) => drained.push(resolve))
    },

    // Barge-in: drop every queued chunk immediately.
    clear() {
      generation += 1
      for (const source of live) {
        try {
          source.onended = null
          source.stop()
        } catch {
          // never started, or already finished
        }
      }
      live.clear()
      active = 0
      nextStartAt = 0
      settleDrained()
    },

    setMuted(muted) {
      if (output) output.gain.value = muted ? 0 : 1
    },

    // null while nothing has played yet, which is lipSync.js's signal to use the
    // procedural envelope instead.
    getAmplitude() {
      if (!analyser) return null
      const bins = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteTimeDomainData(bins)
      let sum = 0
      for (let i = 0; i < bins.length; i++) {
        const value = (bins[i] - 128) / 128
        sum += value * value
      }
      return Math.min(1, Math.sqrt(sum / bins.length) * AMPLITUDE_GAIN)
    },

    async close() {
      this.clear()
      analyser = null
      output = null
      const closing = ctx
      ctx = null
      await closing?.close?.().catch?.(() => {})
    },
  }
}
