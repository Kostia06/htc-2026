// One command to get the scene onto the Quest.
//
// There are four things that must all be true and each fails differently:
// the headset authorised over USB, both servers up, both ports reversed, and
// the browser pointed at localhost (a LAN IP loads the page but silently
// disables immersive mode, which looks like a bug rather than a wrong URL).
//
//   npm run headset

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)
const APP_PORT = 5173
const TTS_PORT = 8788

const ok = (m) => console.log(`  ok    ${m}`)
const bad = (m) => console.log(`  FAIL  ${m}`)

async function adb(args) {
  const { stdout } = await run('adb', args)
  return stdout.trim()
}

async function serving(port) {
  try {
    const res = await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(2500) })
    return res.ok || res.status === 404 // the tts root is a 404 but it is alive
  } catch {
    return false
  }
}

const problems = []

console.log('\nheadset')
let device = ''
try {
  const lines = (await adb(['devices'])).split('\n').slice(1).filter(Boolean)
  const ready = lines.find((l) => l.endsWith('\tdevice'))
  const unauthorised = lines.find((l) => l.endsWith('\tunauthorized'))
  if (ready) {
    device = ready.split('\t')[0]
    ok(`connected (${device})`)
  } else if (unauthorised) {
    bad('connected but not authorised')
    problems.push('Put the headset on and accept "Allow USB debugging", then re-run.')
  } else {
    bad('no device')
    problems.push('Plug the Quest in with a DATA cable (many are charge-only) and wake it — it sleeps off your head.')
  }
} catch {
  bad('adb not found')
  problems.push('brew install --cask android-platform-tools')
}

if (device) {
  // A sleeping headset reports "device" but shows nothing.
  try {
    const power = await adb(['shell', 'dumpsys', 'power'])
    if (/mWakefulness=Asleep/.test(power)) {
      await adb(['shell', 'input', 'keyevent', 'KEYCODE_WAKEUP'])
      ok('was asleep, woken')
    } else {
      ok('awake')
    }
  } catch {
    // Not fatal; the user can wake it by putting it on.
  }
}

console.log('\nservers')
for (const [port, what, how] of [
  [APP_PORT, 'app', 'npm run dev'],
  [TTS_PORT, 'speech', 'npm run tts'],
]) {
  if (await serving(port)) ok(`${what} on ${port}`)
  else {
    bad(`${what} not running on ${port}`)
    problems.push(`Start it in another terminal:  ${how}`)
  }
}

console.log('\nport forwards')
if (device) {
  for (const port of [APP_PORT, TTS_PORT]) {
    try {
      await adb(['reverse', `tcp:${port}`, `tcp:${port}`])
      ok(`localhost:${port} reaches your laptop`)
    } catch {
      bad(`could not reverse ${port}`)
      problems.push(`adb reverse tcp:${port} tcp:${port} failed — check "adb devices".`)
    }
  }
} else {
  bad('skipped, no device')
}

if (problems.length) {
  console.log('\nfix these:')
  problems.forEach((p) => console.log(`  - ${p}`))
  console.log()
  process.exit(1)
}

await adb(['shell', 'am', 'force-stop', 'com.oculus.browser']).catch(() => {})
await adb([
  'shell', 'am', 'start', '-a', 'android.intent.action.VIEW',
  '-d', `http://localhost:${APP_PORT}`, 'com.oculus.browser',
])

console.log(`\nopened http://localhost:${APP_PORT} in the Quest browser.`)
console.log('put the headset on, hold the Meta button to recentre if you do not see it,')
console.log('then press Enter VR on the page.\n')
