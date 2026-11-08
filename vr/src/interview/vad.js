import { openMicrophone } from './microphone.js'

// Voice activity detection: decides when the candidate starts and stops talking
// so the interview needs no push-to-talk. A real interview has no buttons.
//
// The hard part is not detecting speech, it is deciding when someone has
// *finished*. People pause mid-answer to think, so ending the turn on the first
// quiet moment cuts them off. We wait for a sustained silence instead, and only
// after we have actually heard speech.

const DEFAULTS = {
  calibrateMs: 600, // listen to the room before deciding what counts as speech
  startMargin: 2.2, // speech must exceed the noise floor by this factor
  endMargin: 1.5, // ...and fall below this to count as quiet (hysteresis)
  minSpeechMs: 350, // ignore coughs, chair creaks and door bumps
  silenceMs: 1600, // sustained quiet before the turn is considered over
  maxTurnMs: 90000, // hard stop so a stuck mic cannot hang the interview
  floorFallback: 0.012,
}

export function createVoiceDetector(options = {}) {
  const config = { ...DEFAULTS, ...options }

  let ctx = null
  let stream = null
  let analyser = null
  let raf = 0
  let buffer = null

  let state = 'idle' // idle | calibrating | waiting | speaking | ended
  let floor = config.floorFallback
  let calibrationSum = 0
  let calibrationCount = 0
  let startedAt = 0
  let speechStartedAt = 0
  let quietSince = 0
  let level = 0

  const handlers = {
    onSpeechStart: options.onSpeechStart ?? (() => {}),
    onSpeechEnd: options.onSpeechEnd ?? (() => {}),
    onLevel: options.onLevel ?? (() => {}),
  }

  function rms() {
    analyser.getByteTimeDomainData(buffer)
    let sum = 0
    for (let i = 0; i < buffer.length; i++) {
      const v = (buffer[i] - 128) / 128
      sum += v * v
    }
    return Math.sqrt(sum / buffer.length)
  }

  function tick() {
    raf = requestAnimationFrame(tick)
    const now = performance.now()
    level = rms()
    handlers.onLevel(Math.min(1, level * 8))

    if (state === 'calibrating') {
      calibrationSum += level
      calibrationCount++
      if (now - startedAt >= config.calibrateMs) {
        const measured = calibrationSum / Math.max(1, calibrationCount)
        // A dead-silent room would make the floor ~0 and every rustle "speech".
        floor = Math.max(measured, config.floorFallback)
        state = 'waiting'
      }
      return
    }

    if (state === 'waiting') {
      if (level > floor * config.startMargin) {
        if (!speechStartedAt) speechStartedAt = now
        if (now - speechStartedAt >= config.minSpeechMs) {
          state = 'speaking'
          quietSince = 0
          handlers.onSpeechStart()
        }
      } else {
        speechStartedAt = 0
      }
      return
    }

    if (state === 'speaking') {
      if (level > floor * config.endMargin) {
        quietSince = 0
      } else if (!quietSince) {
        quietSince = now
      } else if (now - quietSince >= config.silenceMs) {
        finish('silence')
        return
      }
      if (now - speechStartedAt >= config.maxTurnMs) finish('timeout')
    }
  }

  function finish(reason) {
    if (state === 'ended') return
    state = 'ended'
    handlers.onSpeechEnd(reason)
  }

  return {
    get state() {
      return state
    },
    get level() {
      return Math.min(1, level * 8)
    },
    get analyser() {
      return analyser
    },

    // Resolves to a result object rather than throwing, so a denied mic is a
    // branch the caller handles (offer typed answers) and not a crash.
    //
    // The microphone and audio graph are acquired ONCE and reused for every
    // turn. Tearing them down and rebuilding them each time exhausted the
    // browser's AudioContext budget after a few turns, and detection quietly
    // stopped working mid-interview.
    async start() {
      if (!stream) {
        try {
          stream = await openMicrophone()
        } catch (err) {
          state = 'idle'
          return {
            ok: false,
            reason: err?.name === 'NotAllowedError' ? 'denied' : 'unavailable',
            message: err?.message ?? 'Microphone unavailable.',
          }
        }

        ctx = new (window.AudioContext || window.webkitAudioContext)()
        analyser = ctx.createAnalyser()
        analyser.fftSize = 1024
        analyser.smoothingTimeConstant = 0.3
        ctx.createMediaStreamSource(stream).connect(analyser)
        buffer = new Uint8Array(analyser.fftSize)
      }

      if (ctx.state === 'suspended') await ctx.resume()

      // Re-calibrate every turn: the room changes, and so does the interviewer's
      // own voice bleeding back through the speakers.
      state = 'calibrating'
      startedAt = performance.now()
      speechStartedAt = 0
      quietSince = 0
      calibrationSum = 0
      calibrationCount = 0
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(tick)
      return { ok: true }
    },

    // Ends the turn early, e.g. the candidate pressed the button anyway.
    end() {
      finish('manual')
    },

    // Pauses detection between turns but keeps the microphone open.
    stop() {
      cancelAnimationFrame(raf)
      raf = 0
      state = 'idle'
    },

    // Full teardown. Only on unmount — not between turns.
    release() {
      cancelAnimationFrame(raf)
      raf = 0
      stream?.getTracks().forEach((t) => t.stop())
      stream = null
      ctx?.close().catch(() => {})
      ctx = null
      analyser = null
      state = 'idle'
    },
  }
}
