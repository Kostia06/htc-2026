import { speechKey } from './speechKey.js'
import { connectToSpeakers } from './spatialAudio.js'

// Voice in and out. Also a seam: the Worker will return Gemini TTS audio, which
// goes through speaker.playBuffer() — that path exposes a real AnalyserNode, so
// the lip sync upgrades from procedural to amplitude-driven with no scene change.

// Pre-rendered clips, keyed by the line they speak. Quest Browser ships no
// speech-synthesis voices, so speechSynthesis is silent there; playing an audio
// file is the only way to get a voice in the headset without a backend.
// Served from the laptop over `adb reverse`, so it is localhost on the headset too.
const TTS_URL = import.meta.env?.VITE_TTS_URL || 'http://localhost:8788'

let clipIndex = null
let clipIndexPromise = null

function loadClipIndex() {
  if (clipIndex) return Promise.resolve(clipIndex)
  if (!clipIndexPromise) {
    clipIndexPromise = fetch('/audio/index.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        clipIndex = data?.clips ?? {}
        return clipIndex
      })
      .catch(() => {
        clipIndex = {}
        return clipIndex
      })
  }
  return clipIndexPromise
}

export function createSpeaker() {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null
  let ctx = null
  let analyser = null
  let current = null
  const decoded = new Map()

  loadClipIndex()

  async function decodeUrl(url) {
    if (decoded.has(url)) return decoded.get(url)
    const audioCtx = ensureCtx()
    const response = await fetch(url)
    if (!response.ok) throw new Error(`audio ${response.status}`)
    const buffer = await audioCtx.decodeAudioData(await response.arrayBuffer())
    decoded.set(url, buffer)
    return buffer
  }

  async function playBuffer(buffer) {
    const audioCtx = ensureCtx()
    if (audioCtx.state === 'suspended') await audioCtx.resume()
    return new Promise((resolve) => {
      const source = audioCtx.createBufferSource()
      source.buffer = buffer
      source.connect(analyser)
      source.onended = resolve
      current = source
      source.start()
    })
  }

  function ensureCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)()
      analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.6
      connectToSpeakers(ctx, analyser)
    }
    return ctx
  }

  return {
    // Browsers block audio until a user gesture; call this from the first click
    // or trigger press so the first question is not silently swallowed.
    async unlock() {
      const audioCtx = ensureCtx()
      if (audioCtx.state === 'suspended') await audioCtx.resume()
    },

    estimateMs(text) {
      const clip = clipIndex?.[speechKey(text)]
      if (clip?.ms) return clip.ms
      const words = String(text ?? '').trim().split(/\s+/).filter(Boolean).length
      return Math.max(1400, words * 360)
    },

    // Resolve the audio BEFORE speaking so the caller knows the real duration
    // and can time the mouth to it. Three tiers, best first:
    //   1. a pre-rendered clip   fixed lines, zero latency
    //   2. the local TTS bridge  any text; the Quest has no voices of its own
    //   3. speechSynthesis       desktop only
    async prepare(text) {
      if (!text) return { ms: 0, play: async () => {} }

      const clips = await loadClipIndex()
      const clip = clips?.[speechKey(text)]
      if (clip) {
        const buffer = await decodeUrl(`/audio/${clip.file}`).catch(() => null)
        if (buffer) return { ms: Math.round(buffer.duration * 1000), play: () => playBuffer(buffer) }
      }

      const bridged = await decodeUrl(`${TTS_URL}/tts?text=${encodeURIComponent(text)}`).catch(() => null)
      if (bridged) return { ms: Math.round(bridged.duration * 1000), play: () => playBuffer(bridged) }

      return { ms: this.estimateMs(text), play: () => this.speakWithSynth(text) }
    },

    async speak(text) {
      const { play } = await this.prepare(text)
      return play()
    },

    // Desktop fallback. No audio graph access, so getAmplitude() stays null.
    speakWithSynth(text) {
      if (!synth || !text) return Promise.resolve()
      return new Promise((resolve) => {
        // Some browsers (Quest Browser among them) never fire onend. Without a
        // watchdog that wedges the interview permanently, so resolve on
        // whichever comes first: the event, or the estimated duration.
        let settled = false
        const finish = () => {
          if (settled) return
          settled = true
          clearTimeout(watchdog)
          resolve()
        }
        const words = text.trim().split(/\s+/).filter(Boolean).length
        const watchdog = setTimeout(finish, words * 380 + 2500)

        synth.cancel()
        const utter = new SpeechSynthesisUtterance(text)
        utter.rate = 0.98
        utter.pitch = 1.0
        const preferred = synth
          .getVoices()
          .find((v) => /en-(US|CA|GB)/.test(v.lang) && !/google/i.test(v.name))
        if (preferred) utter.voice = preferred
        utter.onend = finish
        utter.onerror = finish
        current = utter
        synth.speak(utter)
      })
    },

    // Real audio from the Worker. Gives the lip sync true amplitude.
    async playBuffer(arrayBuffer) {
      const audioCtx = ensureCtx()
      if (audioCtx.state === 'suspended') await audioCtx.resume()
      const decoded = await audioCtx.decodeAudioData(arrayBuffer)
      return new Promise((resolve) => {
        const source = audioCtx.createBufferSource()
        source.buffer = decoded
        source.connect(analyser)
        source.onended = resolve
        current = source
        source.start()
      })
    },

    getAmplitude() {
      if (!analyser) return null
      const bins = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteTimeDomainData(bins)
      let sum = 0
      for (let i = 0; i < bins.length; i++) {
        const v = (bins[i] - 128) / 128
        sum += v * v
      }
      return Math.min(1, Math.sqrt(sum / bins.length) * 4)
    },

    cancel() {
      synth?.cancel()
      if (current && typeof current.stop === 'function') {
        try {
          current.stop()
        } catch {
          // already stopped
        }
      }
      current = null
    },
  }
}

// Speech-to-text. Quest Browser support is inconsistent, so every caller must
// handle supported === false: the interview still runs, the answer just arrives
// without a transcript and the Worker scores on audio instead.
export function createListener() {
  const Recognition =
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)

  if (!Recognition) {
    return { supported: false, start() {}, stop: async () => '' }
  }

  let recognition = null
  let transcript = ''
  let running = false
  let wanted = false // true while the candidate still has the floor
  let notify = null

  function attach() {
    recognition = new Recognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-CA'

    recognition.onresult = (event) => {
      let finalText = ''
      let partial = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) finalText += result[0].transcript
        else partial += result[0].transcript
      }
      if (finalText) transcript += finalText
      notify?.((transcript + partial).trim())
    }

    recognition.onerror = () => {}

    // Chrome ends recognition on its own after a quiet stretch or a network
    // blip. If the candidate is still talking we restart it, keeping the text
    // accumulated so far — otherwise the rest of the answer is lost.
    recognition.onend = () => {
      running = false
      if (!wanted) return
      try {
        recognition.start()
        running = true
      } catch {
        // Already starting; the next onend will try again.
      }
    }

    try {
      recognition.start()
      running = true
    } catch {
      running = false
    }
  }

  return {
    supported: true,

    start(onPartial) {
      transcript = ''
      notify = onPartial
      wanted = true
      attach()
    },

    // Always resolves. The old version waited on an `onend` that never comes if
    // recognition had already stopped itself, which wedged the whole turn in
    // "listening" with no way out.
    stop() {
      wanted = false
      return new Promise((resolve) => {
        const text = () => transcript.trim()
        if (!recognition || !running) return resolve(text())

        let settled = false
        const finish = () => {
          if (settled) return
          settled = true
          clearTimeout(watchdog)
          resolve(text())
        }
        const watchdog = setTimeout(finish, 800)

        recognition.onend = () => {
          running = false
          finish()
        }
        try {
          recognition.stop()
        } catch {
          finish()
        }
      })
    },
  }
}
