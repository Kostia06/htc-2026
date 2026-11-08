// Puts the interviewer's voice in his head instead of between the candidate's
// ears. Every playback path (streamed agent audio, pre-rendered clips) ends in
// `connectToSpeakers`, which routes through an HRTF panner; the scene moves the
// panner to the avatar's head and the listener to the headset each frame.
//
// Kept outside React on purpose: the audio graphs are built lazily deep inside
// the playback modules, long after any component could hand them a ref.

const outputs = new Set() // { ctx, panner }
const voice = { x: 0, y: 1.3, z: -1.7 }

function setParam(param, value) {
  if (param) param.value = value
}

function placePanner(panner) {
  if (panner.positionX) {
    setParam(panner.positionX, voice.x)
    setParam(panner.positionY, voice.y)
    setParam(panner.positionZ, voice.z)
  } else {
    panner.setPosition?.(voice.x, voice.y, voice.z)
  }
}

/** Connects `node` to `ctx.destination`, spatialised where the browser can. */
export function connectToSpeakers(ctx, node) {
  if (typeof ctx.createPanner !== 'function') {
    node.connect(ctx.destination)
    return
  }
  const panner = ctx.createPanner()
  panner.panningModel = 'HRTF'
  // Across a desk, about a metre and a half: keep the fall-off gentle so
  // leaning back never makes the question hard to hear.
  panner.distanceModel = 'inverse'
  panner.refDistance = 1.5
  panner.rolloffFactor = 0.5
  placePanner(panner)
  node.connect(panner)
  panner.connect(ctx.destination)
  outputs.add({ ctx, panner })
}

/** Where the voice comes from, in world metres. */
export function setVoicePosition(x, y, z) {
  voice.x = x
  voice.y = y
  voice.z = z
  for (const { panner } of outputs) placePanner(panner)
}

/** The candidate's head: position and the forward / up unit vectors. */
export function setListenerPose(position, forward, up) {
  for (const { ctx } of outputs) {
    if (ctx.state === 'closed') continue
    const listener = ctx.listener
    if (listener.positionX) {
      setParam(listener.positionX, position.x)
      setParam(listener.positionY, position.y)
      setParam(listener.positionZ, position.z)
      setParam(listener.forwardX, forward.x)
      setParam(listener.forwardY, forward.y)
      setParam(listener.forwardZ, forward.z)
      setParam(listener.upX, up.x)
      setParam(listener.upY, up.y)
      setParam(listener.upZ, up.z)
    } else {
      listener.setPosition?.(position.x, position.y, position.z)
      listener.setOrientation?.(forward.x, forward.y, forward.z, up.x, up.y, up.z)
    }
  }
}

/** Drops panners whose context has closed, so a long session does not pile them up. */
export function forgetClosed() {
  for (const entry of outputs) if (entry.ctx.state === 'closed') outputs.delete(entry)
}

export const spatialOutputCount = () => outputs.size
