// One command for the Quest over USB: starts the scene (5173) and the speech server (8788),
// then runs `headset.mjs` to forward both ports and open the scene in the headset.
// The scene talks to the live API (api.skillit.study), so the phone's 4-digit code signs the headset in.
//
//   npm run quest        (from vr/)   ·   npm run quest   (from the repo root)
//
// Stop the web app's dev server first: it also wants port 5173.

import { spawn } from 'node:child_process'

const win = process.platform === 'win32'
const children = []

function start(name, args) {
  const child = spawn('npm', ['run', ...args], { shell: win, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.on('data', (d) => process.stdout.write(`[${name}] ${d}`))
  child.stderr.on('data', (d) => process.stderr.write(`[${name}] ${d}`))
  children.push(child)
  return child
}

function stopAll(code = 0) {
  for (const child of children) child.kill()
  process.exit(code)
}

const scene = start('scene', ['dev', '--', '--port', '5173', '--strictPort'])
start('speech', ['tts'])

// the headset check only makes sense once the scene answers
scene.stdout.on('data', function onReady(d) {
  if (!/ready in/i.test(String(d))) return
  scene.stdout.off('data', onReady)
  const check = spawn('npm', ['run', 'headset'], { shell: win, stdio: 'inherit' })
  check.on('exit', (code) => {
    if (code) console.log('\nHeadset not ready yet: fix the FAIL lines above, then run `npm run headset` in another terminal.')
    else console.log('\nIn the headset: tap Enter VR, then type the 4-digit code from the phone (Practice → Practice in VR).')
  })
})

scene.on('exit', (code) => stopAll(code ?? 1))
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => stopAll(0))
