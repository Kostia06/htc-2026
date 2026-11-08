// One microphone grant for the whole visit, taken on the 2D page before the
// headset goes immersive.
//
// Quest Browser draws its permission prompt as a 2D dialog: asked for the mic
// mid-session, it ends the XR session (the candidate is dropped back on the
// flat page) and the answer is easily lost. So the first getUserMedia happens
// on the Enter VR press, the stream is kept, and every later consumer (the
// ElevenLabs capture, the voice detector) gets a clone of it: cloned tracks
// never prompt, and stopping a clone leaves the grant alive.

const CONSTRAINTS = { echoCancellation: true, noiseSuppression: true, autoGainControl: true }

let primed = null // MediaStream
let priming = null // Promise while the prompt is up

const isLive = (stream) => Boolean(stream?.getAudioTracks?.().some((track) => track.readyState === 'live'))

const reasonOf = (err) => {
  if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') return 'denied'
  if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') return 'missing'
  return 'error'
}

// 'granted' | 'denied' | 'prompt' | 'unknown'. Asking never shows a prompt.
export async function microphonePermission(nav = globalThis.navigator) {
  try {
    const status = await nav?.permissions?.query?.({ name: 'microphone' })
    return status?.state ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

// Opens the mic once and keeps it. Shows the browser's prompt the first time,
// so only call it where a 2D dialog is harmless (the flat page).
export function primeMicrophone(nav = globalThis.navigator) {
  if (isLive(primed)) return Promise.resolve({ ok: true })
  if (!nav?.mediaDevices?.getUserMedia) return Promise.resolve({ ok: false, reason: 'unsupported' })
  if (!priming) {
    priming = nav.mediaDevices
      .getUserMedia({ audio: CONSTRAINTS })
      .then((stream) => {
        primed = stream
        return { ok: true }
      })
      .catch((err) => ({ ok: false, reason: reasonOf(err) }))
      .finally(() => {
        priming = null
      })
  }
  return priming
}

// Before an interview starts. Outside XR it may prompt; inside XR it only goes
// ahead when the browser already granted the mic, because a prompt there would
// throw the candidate out of the room. `needs-2d` means: leave VR and allow it.
export async function ensureMicrophone({ immersive = false, nav = globalThis.navigator } = {}) {
  if (isLive(primed)) return { ok: true }
  if (immersive) {
    const permission = await microphonePermission(nav)
    if (permission === 'denied') return { ok: false, reason: 'denied' }
    if (permission === 'prompt') return { ok: false, reason: 'needs-2d' }
  }
  return primeMicrophone(nav)
}

// A stream for one consumer: a clone of the primed one when there is one, so
// no second permission prompt and no second hardware open on the Quest.
// Throws like getUserMedia so the callers' existing error handling holds.
export async function openMicrophone(constraints = CONSTRAINTS, nav = globalThis.navigator) {
  if (isLive(primed)) return primed.clone()
  return nav.mediaDevices.getUserMedia({ audio: constraints })
}

// The press that takes the headset into VR: microphone first, in 2D, then the
// session. A rejected enter (the prompt can outlast the click's activation) is
// reported, not thrown; the mic is granted by then, so a second press is instant.
//
// One request at a time, and none while a session is live: a second press (or
// the Quest auto-enter racing the button) used to call requestSession again and
// fail with "There is already an active, immersive XRSession".
let entering = null

export function enterImmersive(enter, { prime = primeMicrophone, isActive = () => false } = {}) {
  if (isActive()) return Promise.resolve(true)
  if (!entering) {
    entering = (async () => {
      await prime()
      if (isActive()) return true
      try {
        await enter()
        return true
      } catch (error) {
        console.warn('enter VR failed', error)
        return false
      }
    })().finally(() => {
      entering = null
    })
  }
  return entering
}

export function micProblem(reason) {
  switch (reason) {
    case 'needs-2d':
      return 'Allow the microphone first: take the headset out of VR, press Enter VR and choose Allow.'
    case 'denied':
      return 'Microphone blocked. Allow it for this site in the browser settings, then start again.'
    case 'missing':
      return 'No microphone found.'
    default:
      return 'The microphone could not be opened.'
  }
}

// tests only
export function resetMicrophone() {
  primed?.getTracks?.().forEach((track) => track.stop())
  primed = null
  priming = null
}
