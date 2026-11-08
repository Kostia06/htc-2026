#!/usr/bin/env node
// Pre-renders every line the interviewer speaks into public/audio/*.m4a.
//
//   npm run speech            render anything missing or changed
//   npm run speech -- --force re-render everything
//
// Why this exists: Meta Quest Browser ships zero speech-synthesis voices, so
// speechSynthesis.speak() resolves without making a sound and the interviewer is
// mute in the headset. It works on desktop, which hid the bug. Quest Browser
// plays audio *files* fine, so src/interview/speech.js looks the line up by
// speechKey() and plays the matching clip instead.
//
// macOS only (`say`, `afconvert`, `afinfo`) — it is a build-time step, not a
// runtime dependency, so the rendered files work everywhere.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { speechKey } from '../src/interview/speechKey.js'
import { DEFAULT_SCORE, EXAMPLE_QUESTIONS, EXAMPLE_SCORES } from '../src/interview/questions.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(HERE, '..', 'public', 'audio')
const INDEX_PATH = join(OUT_DIR, 'index.json')

// The only en_* voice installed here that is not a novelty (`say -v '?'` lists
// no Premium/Enhanced variants on this machine). Samantha is also the voice
// desktop Chrome picks, so the headset and the stage backup sound the same.
const VOICE = 'Samantha'
const RATE = 170 // default is ~175-200; an interviewer that rushes reads as impatient
const BITRATE = 48_000 // mono AAC; ~6 KB/sec, so every clip lands far under 200 KB
const MAX_BYTES = 200 * 1024

// Rate is not recorded in index.json (the player does not care), so changing
// RATE above will NOT invalidate existing clips. Re-run with --force.

function main() {
  const force = process.argv.slice(2).includes('--force')
  requireVoice()
  const lines = collectLines()

  mkdirSync(OUT_DIR, { recursive: true })
  const previous = readPreviousIndex(force)

  const clips = {}
  const rows = []
  for (const text of lines) {
    const key = speechKey(text)
    if (clips[key]) continue // same line reached from two places; one clip serves both
    const file = `${key}.m4a`
    const path = join(OUT_DIR, file)

    const cached = previous.clips?.[key]
    const reusable = cached && cached.text === text && cached.ms > 0 && existsSync(path)
    if (reusable) {
      clips[key] = { file, ms: cached.ms, text }
      rows.push({ key, action: 'skip', ms: cached.ms, bytes: statSync(path).size, text })
      continue
    }

    const ms = render(text, path)
    const { size } = statSync(path)
    if (size > MAX_BYTES) {
      throw new Error(`${file} is ${Math.round(size / 1024)} KB, over the ${MAX_BYTES / 1024} KB budget`)
    }
    clips[key] = { file, ms, text }
    rows.push({ key, action: force ? 'force' : 'render', ms, bytes: size, text })
  }

  const index = { voice: VOICE, clips }
  verify(index)
  writeFileSync(INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`)
  const pruned = prune(clips)
  report(rows, pruned)
}

// `say -v Typo` exits 0 and quietly renders with the system default voice, which
// would leave index.json claiming a voice that is not what you are hearing. So
// check the name against the installed list first.
function requireVoice() {
  // Each line is `<name>  <locale>  # <sample>`, but a long name eats its
  // column's padding, so the name is "everything before the locale" rather than
  // a fixed width or a two-space split.
  const installed = run('say', ['-v', '?'])
    .split('\n')
    .map((line) => /^(.+?)\s+[a-z]{2}[-_][A-Za-z_-]+\s+#/.exec(line)?.[1]?.trim())
    .filter(Boolean)
  if (!installed.some((name) => name === VOICE || name.startsWith(`${VOICE} (`))) {
    throw new Error(`voice "${VOICE}" is not installed. Available: ${installed.join(', ')}`)
  }
}

// Every line the interviewer actually says. Imported, not copied, so editing a
// question in questions.js and re-running is all it takes to stay in sync.
function collectLines() {
  const lines = [
    ...EXAMPLE_QUESTIONS.map((q) => q.text),
    ...Object.values(EXAMPLE_SCORES).map((score) => score.tip),
    DEFAULT_SCORE.tip,

    // Verbatim from the `tooShort` branch of submitAnswer in
    // src/interview/session.js. Not exported, so it has to be duplicated here —
    // if you change it there, change it here.
    'That was very short. Interviewers read brevity here as not having an example ready — give the situation, your action, then the result.',

    // Verbatim from `begin` in src/interview/useInterview.js, which interpolates
    // session.start().questionCount. Cover a range so adding or removing a
    // question does not silently mute the intro.
    ...[3, 4, 5, 6].map(
      (n) => `Thanks for coming in. I have ${n} questions about your experience. Take your time.`,
    ),
  ]

  // The end-of-interview summary is deliberately absent: summarize() in
  // session.js builds it from computed averages ("averaging 3.5 out of 5"), so
  // no finite set of files could ever match. It keeps using speechSynthesis.
  const missing = lines.filter((text) => !text || !String(text).trim())
  if (missing.length) throw new Error(`${missing.length} line(s) came back empty — check questions.js`)
  return lines
}

function readPreviousIndex(force) {
  if (force || !existsSync(INDEX_PATH)) return {}
  try {
    const parsed = JSON.parse(readFileSync(INDEX_PATH, 'utf8'))
    // A different voice means every clip is stale, even if the text matches.
    return parsed.voice === VOICE ? parsed : {}
  } catch {
    return {} // unreadable index is not fatal; just re-render
  }
}

// `say` only writes AIFF, so the AAC step is a second pass. Returns the measured
// duration: the player holds the avatar's mouth open for exactly this long, so a
// word-count estimate would defeat the point.
function render(text, path) {
  const aiff = `${path}.aiff`
  try {
    run('say', ['-v', VOICE, '-r', String(RATE), '-o', aiff, text])
    run('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', String(BITRATE), '-c', '1', aiff, path])
  } finally {
    rmSync(aiff, { force: true })
  }

  const info = run('afinfo', [path])
  if (!/\baac\b/.test(info)) throw new Error(`${path} is not an AAC stream:\n${info}`)
  const seconds = Number(/estimated duration: ([\d.]+) sec/.exec(info)?.[1])
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`could not read a duration out of afinfo for ${path}:\n${info}`)
  }
  return Math.round(seconds * 1000)
}

function run(command, args) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (err) {
    throw new Error(`${command} failed: ${(err.stderr || err.message || '').toString().trim()}`)
  }
}

// The contract with src/interview/speech.js, asserted rather than assumed: a key
// that does not round-trip is a clip the player will never find, and the symptom
// is silence — exactly the bug this script exists to fix.
function verify(index) {
  for (const [key, clip] of Object.entries(index.clips)) {
    if (speechKey(clip.text) !== key) throw new Error(`key ${key} does not match speechKey(${clip.text})`)
    if (clip.file !== `${key}.m4a`) throw new Error(`key ${key} points at ${clip.file}`)
    if (!(clip.ms > 0)) throw new Error(`key ${key} has a duration of ${clip.ms}ms`)
    if (!existsSync(join(OUT_DIR, clip.file))) throw new Error(`${clip.file} is missing`)
  }
}

// Drop clips for lines that no longer exist, so an edited question does not
// leave a stale file behind forever.
function prune(clips) {
  const keep = new Set(Object.values(clips).map((clip) => clip.file))
  const stale = readdirSync(OUT_DIR).filter((name) => name.endsWith('.m4a') && !keep.has(name))
  for (const name of stale) rmSync(join(OUT_DIR, name))
  return stale
}

function report(rows, pruned) {
  const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`
  const pad = (value, width) => String(value).padEnd(width)
  console.log(`voice ${VOICE} @ ${RATE} wpm -> ${OUT_DIR}\n`)
  console.log(`${pad('key', 10)}${pad('state', 8)}${'ms'.padStart(6)}${'size'.padStart(10)}  text`)
  for (const row of rows) {
    const text = row.text.length > 56 ? `${row.text.slice(0, 55)}…` : row.text
    console.log(
      `${pad(row.key, 10)}${pad(row.action, 8)}${String(row.ms).padStart(6)}${kb(row.bytes).padStart(10)}  ${text}`,
    )
  }
  const total = rows.reduce((sum, row) => sum + row.bytes, 0)
  const rendered = rows.filter((row) => row.action !== 'skip').length
  console.log(
    `\n${rows.length} clips (${rendered} rendered, ${rows.length - rendered} unchanged), ${kb(total)} total`,
  )
  if (pruned.length) console.log(`pruned ${pruned.length} stale clip(s): ${pruned.join(', ')}`)
  console.log('index.json written. The end-of-interview summary is computed at runtime and stays on speechSynthesis.')
}

try {
  main()
} catch (err) {
  console.error(`render-speech: ${err?.message ?? err}`)
  process.exit(1)
}
