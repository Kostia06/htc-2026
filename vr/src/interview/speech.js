// Voice in and out. Also a seam: the Worker will return Gemini TTS audio, which
// goes through speaker.playBuffer() — that path exposes a real AnalyserNode, so
// the lip sync upgrades from procedural to amplitude-driven with no scene change.

export function createSpeaker() {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null
  let ctx = null
  let analyser = null
  let current = null

  function ensureCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)()
      analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.6
      analyser.connect(ctx.destination)
    }
    return ctx
  }

  return {
    // Browser TTS. No audio graph access, so getAmplitude() stays null and the
    // lip sync falls back to procedural motion.
    speak(text) {
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

  return {
    supported: true,

    start(onPartial) {
      transcript = ''
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
        onPartial?.((transcript + partial).trim())
      }
      recognition.onerror = () => {}
      try {
        recognition.start()
      } catch {
        // start() throws if called while already running
      }
    },

    stop() {
      return new Promise((resolve) => {
        if (!recognition) return resolve('')
        recognition.onend = () => resolve(transcript.trim())
        try {
          recognition.stop()
        } catch {
          resolve(transcript.trim())
        }
      })
    },
  }
}
