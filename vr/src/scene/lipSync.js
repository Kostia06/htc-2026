// Drives Oculus Viseme morph targets on a Ready Player Me head.
//
// Three modes, picked automatically, best first:
//   script set         the viseme schedule built by textToVisemes() from the
//                      exact sentence being spoken, so the mouth matches words
//   amplitude !== null real speech energy from an AnalyserNode (Worker TTS)
//   amplitude === null procedural envelope, because browser speechSynthesis
//                      gives no access to its audio graph
//
// The last two only cycle vowel shapes at a syllable rate, which reads as
// talking rather than chewing but says nothing in particular. They stay as the
// fallback for when we do not know the text or the timing.
// No React here so it can be unit tested.

const VOWELS = ['viseme_aa', 'viseme_E', 'viseme_O', 'viseme_I', 'viseme_U']
const CLOSURES = ['viseme_PP', 'viseme_FF', 'viseme_SS', 'viseme_DD']
const ALL_VISEMES = [...VOWELS, ...CLOSURES, 'viseme_sil', 'viseme_CH', 'viseme_TH', 'viseme_kk', 'viseme_nn', 'viseme_RR']

const VISEME_SET = new Set(ALL_VISEMES)
const VOWEL_SET = new Set(VOWELS)

const SYLLABLE_HZ = 4.2 // average English syllable rate
const BLINK_MIN = 2.1
const BLINK_MAX = 6.4
const BLINK_DURATION = 0.13

// Text -> visemes ------------------------------------------------------------
//
// Grapheme-to-viseme, not phoneme-to-viseme: English spelling is a bad guide to
// pronunciation, but it is a good guide to *mouth shape*, which is all a viseme
// is. Two tables, longest spelling first.

// Multi-letter spellings. [] means the letters make no shape of their own
// (silent gh as in "night", "through").
const DIGRAPHS = {
  th: ['viseme_TH'],
  sh: ['viseme_CH'],
  ch: ['viseme_CH'],
  ph: ['viseme_FF'],
  wh: ['viseme_U'],
  ck: ['viseme_kk'],
  ng: ['viseme_nn'],
  kn: ['viseme_nn'], // silent k
  wr: ['viseme_RR'], // silent w
  gh: [],
  qu: ['viseme_kk', 'viseme_U'],
  oo: ['viseme_U'],
  ee: ['viseme_I'],
  ea: ['viseme_I'],
  ou: ['viseme_U'],
  ow: ['viseme_O'],
  oa: ['viseme_O'],
  ai: ['viseme_E'],
  ay: ['viseme_E'],
  oi: ['viseme_O'],
  oy: ['viseme_O'],
}

// Single letters. null = no shape: /h/ is breath through whatever shape the
// next vowel already needs.
const LETTERS = {
  a: 'viseme_aa', b: 'viseme_PP', c: 'viseme_kk', d: 'viseme_DD',
  e: 'viseme_E',  f: 'viseme_FF', g: 'viseme_kk', h: null,
  i: 'viseme_I',  j: 'viseme_CH', k: 'viseme_kk', l: 'viseme_nn',
  m: 'viseme_PP', n: 'viseme_nn', o: 'viseme_O',  p: 'viseme_PP',
  q: 'viseme_kk', r: 'viseme_RR', s: 'viseme_SS', t: 'viseme_DD',
  u: 'viseme_U',  v: 'viseme_FF', w: 'viseme_U',  x: 'viseme_SS',
  y: 'viseme_I',  z: 'viseme_SS',
}

const VOWEL_LETTERS = new Set(['a', 'e', 'i', 'o', 'u', 'y'])
const SOFT_C_FOLLOWERS = new Set(['e', 'i', 'y']) // "city", not "cat"

// Spoken, so they need mouth shapes like any other word.
const DIGIT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']

// Relative durations, scaled to fit durationMs. Vowels carry the syllable so
// they hold roughly twice as long as a consonant; the pauses are what make the
// delivery read as speech rather than a buzz.
const VOWEL_WEIGHT = 2.2
const CONSONANT_WEIGHT = 1
const PAUSE_WEIGHT = { ',': 3, ';': 3, ':': 3, '-': 2, '—': 3, '.': 6, '?': 6, '!': 6, '…': 6 }

const MS_PER_WORD = 350 // ~170 wpm, the rate speech.js's watchdog assumes

// A trailing 'e' after a consonant is silent ("role", "time", "while"). Short
// words are exempt because there the 'e' is the only vowel ("the", "me").
function stripSilentE(word) {
  const last = word.length - 1
  if (word.length >= 4 && word[last] === 'e' && !VOWEL_LETTERS.has(word[last - 1])) {
    return word.slice(0, last)
  }
  return word
}

// A run of consonants gets at most two shapes, the onset and the release. The
// mouth has no time for one frame per letter in "strengths", and trying looks
// like a stutter.
function collapse(visemes) {
  const out = []
  let run = []
  const flushRun = () => {
    if (run.length > 2) out.push(run[0], run[run.length - 1])
    else out.push(...run)
    run = []
  }
  for (const viseme of visemes) {
    const previous = run.length ? run.at(-1) : out.at(-1)
    if (viseme === previous) continue // "tt", "ss" are one shape, not two
    if (VOWEL_SET.has(viseme)) {
      flushRun()
      out.push(viseme)
    } else {
      run.push(viseme)
    }
  }
  flushRun()
  return out
}

function wordToVisemes(word) {
  const letters = stripSilentE(word)
  const visemes = []
  for (let i = 0; i < letters.length; ) {
    const digraph = DIGRAPHS[letters.slice(i, i + 2)]
    if (digraph) {
      visemes.push(...digraph)
      i += 2
      continue
    }
    const letter = letters[i]
    const viseme =
      letter === 'c' && SOFT_C_FOLLOWERS.has(letters[i + 1]) ? 'viseme_SS' : LETTERS[letter]
    if (viseme) visemes.push(viseme)
    i += 1
  }
  return collapse(visemes)
}

// Flattens text into weighted units, one per mouth shape, in spoken order.
function textToUnits(text) {
  // Apostrophes are not spoken, and dropping them keeps "don't" one word.
  const source = String(text ?? '').toLowerCase().replace(/['’]/g, '')
  const units = []
  const pushPause = (weight) => {
    const last = units.at(-1)
    // "?!" or "..." is one pause, as long as its longest part.
    if (last && last.viseme === 'viseme_sil') last.weight = Math.max(last.weight, weight)
    else units.push({ viseme: 'viseme_sil', weight })
  }
  const pushWord = (word) => {
    for (const viseme of wordToVisemes(word)) {
      units.push({ viseme, weight: VOWEL_SET.has(viseme) ? VOWEL_WEIGHT : CONSONANT_WEIGHT })
    }
  }

  let word = ''
  for (const char of source) {
    if (char >= 'a' && char <= 'z') {
      word += char
    } else {
      if (word) {
        pushWord(word)
        word = ''
      }
      if (char >= '0' && char <= '9') pushWord(DIGIT_WORDS[Number(char)])
      else if (PAUSE_WEIGHT[char]) pushPause(PAUSE_WEIGHT[char])
    }
  }
  if (word) pushWord(word)
  return units
}

// Builds a time-ordered viseme schedule for `text` filling exactly durationMs.
// Entries are contiguous: entry[i].until === entry[i + 1].at, no gaps, no
// overlaps, last .until === durationMs. Returns [] when there is nothing to say
// or no time to say it in.
export function textToVisemes(text, durationMs) {
  const units = textToUnits(text)
  if (!units.length || !Number.isFinite(durationMs) || durationMs <= 0) return []

  const total = units.reduce((sum, unit) => sum + unit.weight, 0)
  const schedule = []
  let at = 0
  let accumulated = 0
  for (const unit of units) {
    accumulated += unit.weight
    // Rounding the running total, not each span, keeps the ends exact.
    const until = Math.max(at, Math.round((accumulated / total) * durationMs))
    schedule.push({ at, until, viseme: unit.viseme })
    at = until
  }
  return schedule
}

// Rough spoken length, for callers that have the text but no audio clock.
export function estimateSpeechMs(text) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean)
  return words.length * MS_PER_WORD
}

const SCRIPT_CROSSFADE_MS = 50 // a hard cut per viseme reads as robotic

// A schedule from somewhere else must not be able to write a key the per-frame
// zeroing loop does not know about — that morph would stay stuck open.
function safeViseme(name) {
  return VISEME_SET.has(name) ? name : 'viseme_sil'
}

export function createFaceDriver() {
  const state = {
    time: 0,
    syllable: 0,
    currentViseme: 'viseme_aa',
    previousViseme: 'viseme_sil',
    weights: new Map(),
    blinkAt: BLINK_MIN,
    blinkPhase: -1,
    envelope: 0,
    script: null,
    scriptStartMs: 0,
    scriptIndex: 0,
  }

  // Deterministic but non-repeating-looking viseme order. Avoids Math.random so
  // two runs of the demo look the same.
  function pickViseme(index) {
    const useClosure = index % 3 === 2
    const table = useClosure ? CLOSURES : VOWELS
    return table[(index * 7) % table.length]
  }

  // `startedAt` is milliseconds on this driver's own clock (state.time * 1000),
  // not Date.now — the demo has to replay identically. Default is "right now";
  // pass state.time * 1000 + latency to account for TTS start-up delay.
  function setScript(schedule, { startedAt } = {}) {
    if (!Array.isArray(schedule) || schedule.length === 0) {
      clearScript()
      return
    }
    state.script = schedule
    state.scriptStartMs = Number.isFinite(startedAt) ? startedAt : state.time * 1000
    state.scriptIndex = 0
  }

  function clearScript() {
    state.script = null
    state.scriptStartMs = 0
    state.scriptIndex = 0
  }

  function scriptElapsedMs() {
    return state.time * 1000 - state.scriptStartMs
  }

  // True while a schedule is set and the clock has not run past its end.
  function scriptActive() {
    return state.script !== null && scriptElapsedMs() < state.script.at(-1).until
  }

  // Walks the pointer instead of searching: frames advance monotonically, so
  // this is O(1) in the common case. The backward walk only matters if a caller
  // rewinds the schedule.
  function seek(elapsedMs) {
    const script = state.script
    while (state.scriptIndex < script.length - 1 && elapsedMs >= script[state.scriptIndex].until) {
      state.scriptIndex++
    }
    while (state.scriptIndex > 0 && elapsedMs < script[state.scriptIndex].at) {
      state.scriptIndex--
    }
    return script[state.scriptIndex]
  }

  function update(delta, { speaking = false, amplitude = null, listening = false } = {}) {
    state.time += delta

    // Speech envelope ---------------------------------------------------------
    let target = 0
    if (speaking) {
      if (amplitude !== null && amplitude !== undefined) {
        target = amplitude
      } else {
        const t = state.time
        const base = 0.55 + 0.45 * Math.sin(t * SYLLABLE_HZ * Math.PI * 2)
        const accent = 0.25 * Math.sin(t * 1.7 + 0.6)
        const pause = Math.max(0, Math.sin(t * 0.31 + 2.2)) // occasional breath
        target = Math.max(0, Math.min(1, (base + accent) * (0.55 + 0.45 * pause)))
      }
    }
    const attack = speaking ? 0.00008 : 0.0000004
    state.envelope += (target - state.envelope) * (1 - Math.pow(attack, delta))

    // Syllable advance --------------------------------------------------------
    // Kept running even while a script drives the mouth, so that handing control
    // back to the procedural path mid-sentence picks up exactly where it would
    // have been.
    const syllableIndex = Math.floor(state.time * SYLLABLE_HZ)
    if (syllableIndex !== state.syllable) {
      state.syllable = syllableIndex
      state.previousViseme = state.currentViseme
      state.currentViseme = pickViseme(syllableIndex)
    }

    // Blend visemes -----------------------------------------------------------
    for (const name of ALL_VISEMES) state.weights.set(name, 0)
    if (speaking && scriptActive()) {
      const elapsedMs = Math.max(0, scriptElapsedMs())
      const entry = seek(elapsedMs)
      const previous = state.scriptIndex > 0 ? state.script[state.scriptIndex - 1].viseme : 'viseme_sil'
      const fade = Math.min(SCRIPT_CROSSFADE_MS, Math.max(1, entry.until - entry.at))
      const mix = Math.min(1, (elapsedMs - entry.at) / fade)
      const into = safeViseme(entry.viseme)
      const from = safeViseme(previous)
      if (from === into) {
        state.weights.set(into, 1)
      } else {
        state.weights.set(into, mix)
        state.weights.set(from, 1 - mix)
      }
    } else if (state.envelope > 0.01) {
      const within = (state.time * SYLLABLE_HZ) % 1
      state.weights.set(state.currentViseme, state.envelope * within)
      state.weights.set(state.previousViseme, state.envelope * (1 - within))
    } else {
      state.weights.set('viseme_sil', 1)
    }

    // Blink -------------------------------------------------------------------
    let blink = 0
    if (state.blinkPhase >= 0) {
      state.blinkPhase += delta
      const half = BLINK_DURATION / 2
      blink =
        state.blinkPhase < half
          ? state.blinkPhase / half
          : 1 - (state.blinkPhase - half) / half
      blink = Math.max(0, Math.min(1, blink))
      if (state.blinkPhase >= BLINK_DURATION) {
        state.blinkPhase = -1
        // Vary the next gap without Math.random, so replays match.
        const spread = (Math.sin(state.time * 12.9898) + 1) / 2
        state.blinkAt = state.time + BLINK_MIN + spread * (BLINK_MAX - BLINK_MIN)
      }
    } else if (state.time >= state.blinkAt) {
      state.blinkPhase = 0
    }

    return {
      visemes: state.weights,
      jawOpen: state.envelope * 0.42,
      blink,
      // A faint attentive expression while the candidate is talking.
      browInnerUp: listening ? 0.16 : 0.04,
      mouthSmile: listening ? 0.12 : 0.05,
    }
  }

  return { update, setScript, clearScript, scriptActive, state }
}

export { ALL_VISEMES }
