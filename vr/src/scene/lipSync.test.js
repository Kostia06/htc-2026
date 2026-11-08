import { describe, expect, it } from 'vitest'
import { ALL_VISEMES, createFaceDriver, estimateSpeechMs, textToVisemes } from './lipSync.js'

const FRAME = 1 / 60

// update() hands back the same Map every frame so it allocates nothing in the
// render loop — anything compared across frames has to be copied out first.
function snapshot(out) {
  return {
    jawOpen: out.jawOpen,
    blink: out.blink,
    browInnerUp: out.browInnerUp,
    mouthSmile: out.mouthSmile,
    visemes: Object.fromEntries(out.visemes),
  }
}

function run(driver, frames, input, delta = FRAME) {
  const out = []
  for (let i = 0; i < frames; i++) out.push(snapshot(driver.update(delta, input)))
  return out
}

const dominant = (frame) => Object.entries(frame.visemes).sort((a, b) => b[1] - a[1])[0][0]

const numbers = (frame) => [
  frame.jawOpen,
  frame.blink,
  frame.browInnerUp,
  frame.mouthSmile,
  ...Object.values(frame.visemes),
]

describe('createFaceDriver', () => {
  it('closes the mouth once speech stops', () => {
    const driver = createFaceDriver()
    run(driver, 60, { speaking: true, amplitude: 0.9 })
    const silence = run(driver, 60, { speaking: false })
    const last = silence.at(-1)

    expect(last.jawOpen).toBeLessThan(0.01)
    expect(last.visemes.viseme_sil).toBe(1)
    for (const name of ALL_VISEMES) {
      if (name !== 'viseme_sil') expect(last.visemes[name]).toBe(0)
    }
    // A decay, not a cut — a jaw that snaps shut reads as a glitch.
    expect(silence[0].jawOpen).toBeGreaterThan(silence[20].jawOpen)
  })

  it('moves the mouth in procedural mode, with no amplitude to follow', () => {
    const frames = run(createFaceDriver(), 120, { speaking: true, amplitude: null })
    const shapes = new Set(frames.map(dominant))
    // Second second only: by then the attack has settled, so a mouth that
    // merely ramped up and then held still shows up as one value here.
    const openings = new Set(frames.slice(60).map((f) => f.jawOpen.toFixed(4)))

    expect(shapes.size).toBeGreaterThan(2) // cycles vowel shapes, not one held vowel
    expect(openings.size).toBeGreaterThan(50)
    expect(Math.max(...frames.map((f) => f.jawOpen))).toBeGreaterThan(0.1)
  })

  it('tracks an explicit amplitude', () => {
    const quiet = run(createFaceDriver(), 60, { speaking: true, amplitude: 0.2 }).at(-1)
    const loud = run(createFaceDriver(), 60, { speaking: true, amplitude: 0.9 }).at(-1)

    expect(loud.jawOpen).toBeGreaterThan(quiet.jawOpen)
    expect(quiet.jawOpen).toBeCloseTo(0.2 * 0.42, 2)
    expect(loud.jawOpen).toBeCloseTo(0.9 * 0.42, 2)
  })

  it('replays identically for the same delta sequence', () => {
    const deltas = Array.from({ length: 400 }, (_, i) => 0.012 + ((i * 7) % 11) * 0.0015)
    const feed = (driver) =>
      deltas.map((delta, i) =>
        snapshot(
          driver.update(delta, {
            speaking: i % 90 < 60,
            amplitude: null,
            listening: i % 90 >= 60,
          }),
        ),
      )

    expect(feed(createFaceDriver())).toEqual(feed(createFaceDriver()))
  })

  it('blinks repeatedly and reopens the eyes in between', () => {
    const blinks = run(createFaceDriver(), 15 * 60, { speaking: false }).map((f) => f.blink)

    let events = 0
    for (let i = 1; i < blinks.length; i++) {
      if (blinks[i] > 0.5 && blinks[i - 1] <= 0.5) events++
    }
    const firstPeak = blinks.findIndex((b) => b > 0.5)

    expect(events).toBeGreaterThanOrEqual(2)
    expect(blinks.slice(firstPeak).some((b) => b === 0)).toBe(true)
    // Eyes are open the vast majority of the time, not half shut.
    expect(blinks.filter((b) => b === 0).length).toBeGreaterThan(blinks.length * 0.9)
  })

  it('survives a dropped frame without producing NaN', () => {
    for (const delta of [0, 0.5, 1.5, 5]) {
      const driver = createFaceDriver()
      run(driver, 150, { speaking: true, amplitude: null }) // mid-blink, mid-syllable
      const frame = snapshot(driver.update(delta, { speaking: true, amplitude: null }))

      for (const n of numbers(frame)) {
        expect(Number.isFinite(n), `delta ${delta} produced ${n}`).toBe(true)
        expect(n).toBeGreaterThanOrEqual(0)
        expect(n).toBeLessThanOrEqual(1)
      }
    }
  })
})

// Where the schedule says the mouth should be at `ms`.
function entryAt(schedule, ms) {
  return schedule.find((e) => ms >= e.at && ms < e.until) ?? null
}

const shapes = (schedule) => schedule.map((e) => e.viseme.replace('viseme_', ''))

describe('textToVisemes', () => {
  it('fills the whole duration with a contiguous schedule', () => {
    const schedule = textToVisemes('hello world', 2000)

    expect(schedule.length).toBeGreaterThan(4)
    expect(schedule[0].at).toBe(0)
    expect(schedule.at(-1).until).toBe(2000)
    for (let i = 0; i < schedule.length; i++) {
      const entry = schedule[i]
      expect(entry.until).toBeGreaterThanOrEqual(entry.at)
      expect(ALL_VISEMES).toContain(entry.viseme)
      // No overlap and no gap: one shape hands straight over to the next.
      if (i > 0) expect(entry.at).toBe(schedule[i - 1].until)
    }
  })

  it('puts viseme_PP exactly where the lips close in "mama"', () => {
    const schedule = textToVisemes('mama', 800)

    expect(shapes(schedule)).toEqual(['PP', 'aa', 'PP', 'aa'])
    expect(schedule[0].at).toBe(0)
    // Both closures land inside the word, in the first and second half.
    expect(entryAt(schedule, schedule[0].until - 1).viseme).toBe('viseme_PP')
    expect(entryAt(schedule, schedule[2].at + 1).viseme).toBe('viseme_PP')
    expect(schedule[2].at).toBeGreaterThan(200)
    expect(schedule[2].at).toBeLessThan(500)
  })

  it('maps the other bilabials onto the same closure', () => {
    expect(shapes(textToVisemes('papa', 800))).toEqual(['PP', 'aa', 'PP', 'aa'])
    expect(shapes(textToVisemes('baba', 800))).toEqual(['PP', 'aa', 'PP', 'aa'])
  })

  it('inserts viseme_sil pauses at punctuation', () => {
    const schedule = textToVisemes('Yes, I did. Why?', 4000)
    const pauses = schedule.filter((e) => e.viseme === 'viseme_sil')

    expect(pauses.length).toBe(3) // comma, full stop, question mark
    expect(pauses.every((p) => p.until > p.at)).toBe(true)
    // The comma pause is interior, so the breath is actually visible mid-sentence.
    expect(pauses[0].at).toBeGreaterThan(0)
    expect(pauses[0].at).toBeLessThan(schedule.at(-1).until)
    // A sentence end is a longer breath than a comma.
    expect(pauses[1].until - pauses[1].at).toBeGreaterThan(pauses[0].until - pauses[0].at)
    // Nothing is said during a pause.
    expect(entryAt(schedule, pauses[0].at + 1).viseme).toBe('viseme_sil')
  })

  it('collapses consonant clusters instead of one frame per letter', () => {
    // s-t-r and ng-th-s are three letters each but only get the onset and the
    // release, so "strengths" is far shorter than its spelling.
    expect(shapes(textToVisemes('strengths', 900))).toEqual(['SS', 'RR', 'E', 'nn', 'SS'])
    // Doubled letters are one shape.
    expect(shapes(textToVisemes('better', 900))).toEqual(['PP', 'E', 'DD', 'E', 'RR'])
  })

  it('handles digraphs rather than spelling them out', () => {
    expect(shapes(textToVisemes('the', 500))).toEqual(['TH', 'E'])
    expect(shapes(textToVisemes('ship', 500))).toEqual(['CH', 'I', 'PP'])
    expect(shapes(textToVisemes('chop', 500))).toEqual(['CH', 'O', 'PP'])
    expect(shapes(textToVisemes('phone', 500))).toEqual(['FF', 'O', 'nn'])
    expect(shapes(textToVisemes('quick', 500))).toEqual(['kk', 'U', 'I', 'kk'])
    expect(shapes(textToVisemes('sing', 500))).toEqual(['SS', 'I', 'nn'])
    expect(shapes(textToVisemes('soon', 500))).toEqual(['SS', 'U', 'nn'])
    expect(shapes(textToVisemes('see', 500))).toEqual(['SS', 'I'])
    expect(shapes(textToVisemes('team', 500))).toEqual(['DD', 'I', 'PP'])
    expect(shapes(textToVisemes('out', 500))).toEqual(['U', 'DD'])
    expect(shapes(textToVisemes('rain', 500))).toEqual(['RR', 'E', 'nn'])
  })

  it('drops a silent trailing e but keeps a spoken one', () => {
    expect(shapes(textToVisemes('role', 500))).toEqual(['RR', 'O', 'nn'])
    expect(shapes(textToVisemes('time', 500))).toEqual(['DD', 'I', 'PP'])
    expect(shapes(textToVisemes('me', 500))).toEqual(['PP', 'E'])
    expect(shapes(textToVisemes('three', 500))).toEqual(['TH', 'RR', 'I'])
  })

  it('spreads longer text over a longer duration proportionally', () => {
    const short = textToVisemes('hello world', 2000)
    const long = textToVisemes('hello world hello world', 4000)

    expect(long.length).toBe(short.length * 2)
    expect(long.at(-1).until).toBe(4000)
    // The same words occupy the same share of the timeline either way.
    for (let i = 0; i < short.length; i++) {
      expect(long[i].viseme).toBe(short[i].viseme)
      expect(long[i].at).toBeCloseTo(short[i].at, 0)
    }

    // Same text, twice the time: every boundary doubles.
    const slow = textToVisemes('hello world', 4000)
    expect(slow.length).toBe(short.length)
    for (let i = 0; i < short.length; i++) {
      expect(Math.abs(slow[i].at - short[i].at * 2)).toBeLessThanOrEqual(2) // rounding only
    }
  })

  it('pronounces digits and ignores symbols', () => {
    // "4" has to be spoken as "four", or numbers in a question go silent.
    expect(shapes(textToVisemes('4', 500))).toEqual(shapes(textToVisemes('four', 500)))
    expect(shapes(textToVisemes('4', 500))[0]).toBe('FF')
    expect(shapes(textToVisemes('don’t', 500))).toEqual(shapes(textToVisemes('dont', 500)))
    expect(shapes(textToVisemes('a #@% b', 500))).toEqual(['aa', 'PP'])
  })

  it('returns a finite, empty-or-valid schedule for degenerate input', () => {
    const cases = [
      ['', 1000],
      ['   \n\t ', 1000],
      ['...', 1000],
      ['?!,', 1000],
      ['hello', 0],
      ['hello', -500],
      ['hello', NaN],
      ['hello', undefined],
      ['hi 2 + 2 = 4 #@%', 1500],
      [null, 1000],
      [undefined, 1000],
    ]

    for (const [text, duration] of cases) {
      const schedule = textToVisemes(text, duration)
      expect(Array.isArray(schedule), `${text} / ${duration}`).toBe(true)
      for (const entry of schedule) {
        expect(Number.isFinite(entry.at), `${text} / ${duration}`).toBe(true)
        expect(Number.isFinite(entry.until), `${text} / ${duration}`).toBe(true)
        expect(entry.until).toBeGreaterThanOrEqual(entry.at)
        expect(ALL_VISEMES).toContain(entry.viseme)
      }
      if (schedule.length) {
        expect(schedule[0].at).toBe(0)
        expect(schedule.at(-1).until).toBe(duration)
      }
    }
  })

  it('estimates a spoken duration from the word count', () => {
    expect(estimateSpeechMs('')).toBe(0)
    expect(estimateSpeechMs('   ')).toBe(0)
    expect(estimateSpeechMs(null)).toBe(0)
    expect(estimateSpeechMs('one two three')).toBeGreaterThan(estimateSpeechMs('one two'))
    // A real interview question lands in a believable range, not 0.5s or 30s.
    const ms = estimateSpeechMs('Why this company, and why this role specifically?')
    expect(ms).toBeGreaterThan(2000)
    expect(ms).toBeLessThan(6000)
  })
})

describe('createFaceDriver with a script', () => {
  const SCHEDULE = textToVisemes('Hello there, tell me about a project.', 3000)

  it('follows the schedule, blending only between neighbouring shapes', () => {
    const driver = createFaceDriver()
    driver.setScript(SCHEDULE, { startedAt: 0 })

    for (let i = 1; i <= 3000 / (FRAME * 1000); i++) {
      const frame = snapshot(driver.update(FRAME, { speaking: true, amplitude: null }))
      const ms = i * FRAME * 1000
      const entry = entryAt(SCHEDULE, ms)
      if (!entry) continue
      const index = SCHEDULE.indexOf(entry)
      const previous = index > 0 ? SCHEDULE[index - 1].viseme : 'viseme_sil'

      const total = Object.values(frame.visemes).reduce((a, b) => a + b, 0)
      expect(total, `t=${ms}`).toBeCloseTo(1, 5)
      // Zero only at the exact instant the crossfade into this shape begins.
      if (ms > entry.at) expect(frame.visemes[entry.viseme], `t=${ms}`).toBeGreaterThan(0)
      for (const name of ALL_VISEMES) {
        if (name === entry.viseme || name === previous) continue
        expect(frame.visemes[name], `t=${ms} leaked ${name}`).toBe(0)
      }
      // Fully formed once the crossfade is done.
      if (ms - entry.at >= 60) expect(frame.visemes[entry.viseme], `t=${ms}`).toBeCloseTo(1, 5)
    }
  })

  it('crossfades into a new shape rather than cutting to it', () => {
    const driver = createFaceDriver()
    driver.setScript(SCHEDULE, { startedAt: 0 })

    let blendedFrames = 0
    let biggestJump = 0
    let previous = null
    for (let i = 0; i < 3000 / (FRAME * 1000); i++) {
      const frame = snapshot(driver.update(FRAME, { speaking: true, amplitude: null }))
      const active = Object.values(frame.visemes).filter((w) => w > 0.01)
      if (active.length > 1) blendedFrames++
      if (previous) {
        for (const name of ALL_VISEMES) {
          biggestJump = Math.max(biggestJump, Math.abs(frame.visemes[name] - previous.visemes[name]))
        }
      }
      previous = frame
    }

    expect(blendedFrames).toBeGreaterThan(20) // not a hard cut per viseme
    expect(biggestJump).toBeLessThan(0.5) // ~50ms fade is 3 frames at 60fps
  })

  it('hands back to the procedural envelope once the schedule runs out', () => {
    const scripted = createFaceDriver()
    const procedural = createFaceDriver()
    scripted.setScript(SCHEDULE, { startedAt: 0 })

    const input = { speaking: true, amplitude: null }
    const frames = Math.ceil(3200 / (FRAME * 1000))
    for (let i = 0; i < frames; i++) {
      scripted.update(FRAME, input)
      procedural.update(FRAME, input)
    }

    expect(scripted.scriptActive()).toBe(false)
    // Identical from here on: the script only ever overrode viseme weights, so
    // nothing about the fallback path drifted while it was in charge.
    for (let i = 0; i < 120; i++) {
      expect(snapshot(scripted.update(FRAME, input))).toEqual(snapshot(procedural.update(FRAME, input)))
    }
  })

  it('falls back immediately on clearScript, and behaves as before with no script', () => {
    const cleared = createFaceDriver()
    const never = createFaceDriver()
    cleared.setScript(SCHEDULE, { startedAt: 0 })
    cleared.clearScript()

    expect(cleared.scriptActive()).toBe(false)
    const input = { speaking: true, amplitude: null }
    for (let i = 0; i < 200; i++) {
      expect(snapshot(cleared.update(FRAME, input))).toEqual(snapshot(never.update(FRAME, input)))
    }
    // An empty or missing schedule is the same as no script at all.
    const empty = createFaceDriver()
    empty.setScript([])
    expect(empty.scriptActive()).toBe(false)
    empty.setScript(null)
    expect(empty.scriptActive()).toBe(false)
  })

  it('ignores the script while not speaking', () => {
    const driver = createFaceDriver()
    driver.setScript(SCHEDULE, { startedAt: 0 })
    const frame = run(driver, 30, { speaking: false }).at(-1)

    expect(frame.visemes.viseme_sil).toBe(1)
    expect(frame.jawOpen).toBeLessThan(0.01)
  })

  it('replays identically with a script, and keeps returning one Map', () => {
    const deltas = Array.from({ length: 300 }, (_, i) => 0.012 + ((i * 7) % 11) * 0.0015)
    const feed = (driver) => {
      driver.setScript(SCHEDULE, { startedAt: 0 })
      return deltas.map((delta, i) =>
        snapshot(driver.update(delta, { speaking: i % 120 < 100, amplitude: null, listening: false })),
      )
    }

    expect(feed(createFaceDriver())).toEqual(feed(createFaceDriver()))

    // Zero allocation at 90fps: the same Map, mutated in place.
    const driver = createFaceDriver()
    driver.setScript(SCHEDULE, { startedAt: 0 })
    const first = driver.update(FRAME, { speaking: true }).visemes
    for (let i = 0; i < 50; i++) {
      expect(driver.update(FRAME, { speaking: true }).visemes).toBe(first)
    }
  })

  it('never leaves a stray morph set by an unknown viseme', () => {
    const driver = createFaceDriver()
    driver.setScript([{ at: 0, until: 200, viseme: 'viseme_nonsense' }], { startedAt: 0 })

    const frame = driver.update(FRAME, { speaking: true, amplitude: null })
    expect(frame.visemes.size).toBe(ALL_VISEMES.length)
    expect(frame.visemes.get('viseme_sil')).toBeGreaterThan(0)
    for (const n of numbers(snapshot(frame))) expect(Number.isFinite(n)).toBe(true)
  })

  it('does not NaN on a dropped frame mid-script', () => {
    for (const delta of [0, 0.5, 1.5, 5]) {
      const driver = createFaceDriver()
      driver.setScript(SCHEDULE, { startedAt: 0 })
      run(driver, 60, { speaking: true, amplitude: null })
      const frame = snapshot(driver.update(delta, { speaking: true, amplitude: null }))

      for (const n of numbers(frame)) {
        expect(Number.isFinite(n), `delta ${delta} produced ${n}`).toBe(true)
        expect(n).toBeGreaterThanOrEqual(0)
        expect(n).toBeLessThanOrEqual(1)
      }
    }
  })
})
