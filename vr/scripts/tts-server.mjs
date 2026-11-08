// On-demand speech for the headset.
//
// Meta Quest Browser ships no speech-synthesis voices, so speechSynthesis is
// silent there. Pre-rendered clips cover fixed lines, but the interviewer's
// questions and follow-ups are written by the server at runtime, so they can
// never be pre-rendered. This serves any text as audio using the Mac's own
// `say`, which works because the laptop is already tethered to the headset.
//
//   node scripts/tts-server.mjs
//   adb reverse tcp:8788 tcp:8788      # so the headset can reach it
//
// Dev-time only. In production the voice comes from the Worker's provider.

import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)
const PORT = Number(process.env.TTS_PORT ?? 8788)
const VOICE = process.env.TTS_VOICE ?? 'Samantha'
const RATE = process.env.TTS_RATE ?? '170'
const CACHE = join(process.cwd(), '.tts-cache')
const MAX_CHARS = 1200

const key = (text) => createHash('sha1').update(`${VOICE}|${RATE}|${text}`).digest('hex').slice(0, 16)

async function render(text) {
  const id = key(text)
  const out = join(CACHE, `${id}.m4a`)
  if (existsSync(out)) return out

  const aiff = join(CACHE, `${id}.aiff`)
  await run('say', ['-v', VOICE, '-r', RATE, '-o', aiff, text])
  await run('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '48000', aiff, out])
  await unlink(aiff).catch(() => {})
  return out
}

const server = createServer(async (req, res) => {
  // The headset reaches this through adb reverse, so the origin is localhost.
  res.setHeader('access-control-allow-origin', '*')
  res.setHeader('access-control-allow-headers', 'content-type')
  if (req.method === 'OPTIONS') return res.writeHead(204).end()

  const url = new URL(req.url, `http://localhost:${PORT}`)
  if (url.pathname === '/health') {
    return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: true, voice: VOICE }))
  }
  if (url.pathname !== '/tts') return res.writeHead(404).end('not found')

  const text = (url.searchParams.get('text') ?? '').trim().slice(0, MAX_CHARS)
  if (!text) return res.writeHead(400).end('missing text')

  try {
    const file = await render(text)
    const audio = await readFile(file)
    res.writeHead(200, {
      'content-type': 'audio/mp4',
      'content-length': audio.length,
      'cache-control': 'public, max-age=86400',
    })
    res.end(audio)
  } catch (err) {
    console.error('tts failed:', err.message)
    res.writeHead(500).end('tts failed')
  }
})

await mkdir(CACHE, { recursive: true })
server.listen(PORT, () => {
  console.log(`tts on http://localhost:${PORT}  voice=${VOICE} rate=${RATE}`)
  console.log(`for the headset:  adb reverse tcp:${PORT} tcp:${PORT}`)
})
