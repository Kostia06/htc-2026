// Arms, hands and the slower body language that makes the interviewer read as a
// person rather than a mannequin: forearms resting on the table, relaxed fingers,
// hand gestures while talking, nods and a lean-in while listening.
//
// The arms are placed with two-bone IK against hand targets in the model's own
// space (metres, the avatar faces +z, its left is +x), so torso sway never drags
// the hands through the table. Palm and finger directions are measured from the
// rig at load time rather than hard-coded per vendor.

import * as THREE from 'three'

// Hand (wrist) targets in model space, tuned against the boardroom table with the
// real mesh (`node scripts/mesh-probe.mjs`): at y 1.133 the hand lies nearly flat,
// palm and fingertips a couple of millimetres above the 0.745 m table top.
export const ARM_POSE = {
  rest: { x: 0.15, y: 1.133, z: 0.3 },
  // elbows out, down and back: where a seated person's elbows hang
  pole: { x: 0.5, y: -0.55, z: -0.35 },
  // how far a talking hand lifts and comes forward off the table
  gesture: { x: 0.035, y: 0.1, z: 0.07 },
}

const CURL = { rest: [0.14, 0.2, 0.14], open: [0.06, 0.1, 0.06], thumb: 0.3 }
const MAX_WRIST_BEND = 0.7
const MAX_PALM_TWIST = 1.9
// how much of the forearm roll happens at the elbow end; the rest goes in the wrist
const FOREARM_SHARE = 0.55

const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _c = new THREE.Vector3()
const _d = new THREE.Vector3()
const _e = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _wq = new THREE.Quaternion()
const _pq = new THREE.Quaternion()
const _id = new THREE.Quaternion()

const worldPos = (bone, out) => bone.getWorldPosition(out)

function setWorldQuaternion(bone, world) {
  bone.parent.getWorldQuaternion(_pq)
  bone.quaternion.copy(_pq.invert().multiply(world))
  bone.updateMatrixWorld(true)
}

function rotateWorld(bone, q) {
  bone.getWorldQuaternion(_wq)
  setWorldQuaternion(bone, _wq.premultiply(q))
}

// Turns `bone` so the point `from` (a child joint) moves onto the line toward `to`.
function aim(bone, from, to) {
  worldPos(bone, _a)
  _b.subVectors(from, _a).normalize()
  _c.subVectors(to, _a).normalize()
  rotateWorld(bone, _q.setFromUnitVectors(_b, _c))
}

// Signed angle that rotates `from` onto `to` around `axis`, both projected flat.
function angleAround(from, to, axis) {
  const f = _d.copy(from).projectOnPlane(axis)
  const t = _e.copy(to).projectOnPlane(axis)
  if (f.lengthSq() < 1e-8 || t.lengthSq() < 1e-8) return 0
  return Math.atan2(axis.dot(f.clone().cross(t)), f.dot(t))
}

const boneChildren = (bone) => bone.children.filter((c) => c.isBone)

function chainFrom(base) {
  const chain = [base]
  for (let next = boneChildren(base)[0]; next; next = boneChildren(next)[0]) chain.push(next)
  return chain
}

const isThumb = (bone) => /thumb|finger0$/i.test(bone.name.replace(/[\s_.-]/g, ''))

function buildHand(hand, forearm) {
  const chains = boneChildren(hand).map(chainFrom).filter((chain) => chain.length > 1)
  const fingers = chains.filter((chain) => !isThumb(chain[0]))
  const thumb = chains.find((chain) => isThumb(chain[0]))

  const wrist = worldPos(hand, new THREE.Vector3())
  hand.getWorldQuaternion(_wq)
  const toLocal = _wq.clone().invert()

  // finger direction: wrist toward the middle of the knuckles
  const knuckles = new THREE.Vector3()
  fingers.forEach((chain) => knuckles.add(worldPos(chain[0], new THREE.Vector3())))
  if (fingers.length) knuckles.divideScalar(fingers.length)
  else worldPos(hand, knuckles).add(worldPos(forearm, _a).negate().add(wrist).normalize())
  const along = knuckles.clone().sub(wrist).normalize()

  // palm side: rest-pose fingers are slightly curled, so the tips lean toward the palm
  const lean = new THREE.Vector3()
  for (const chain of fingers) {
    const base = worldPos(chain[0], new THREE.Vector3())
    const reach = worldPos(chain.at(-1), new THREE.Vector3()).sub(base)
    lean.add(reach.projectOnPlane(along))
  }
  let palm
  if (fingers.length >= 2) {
    const across = worldPos(fingers[0][0], new THREE.Vector3()).sub(worldPos(fingers.at(-1)[0], _a))
    palm = along.clone().cross(across).normalize()
    if (palm.dot(lean) < 0) palm.negate()
  } else {
    palm = lean.lengthSq() > 1e-8 ? lean.normalize() : new THREE.Vector3(0, 0, 1)
  }

  // the axis each segment bends around to curl toward the palm, in that bone's own frame
  const curlChain = (chain) =>
    chain.slice(0, -1).map((bone) => {
      const dir = worldPos(boneChildren(bone)[0], new THREE.Vector3()).sub(worldPos(bone, _a)).normalize()
      const axis = dir.cross(palm).normalize()
      bone.getWorldQuaternion(_wq)
      return { bone, rest: bone.quaternion.clone(), axis: axis.applyQuaternion(_wq.invert()) }
    })

  return {
    along: along.applyQuaternion(toLocal),
    palm: palm.clone().applyQuaternion(toLocal),
    fingers: fingers.map(curlChain),
    thumb: thumb ? curlChain(thumb) : [],
  }
}

function buildArm(bones, side) {
  const upper = bones[`${side}Arm`]
  const fore = bones[`${side}ForeArm`]
  const hand = bones[`${side}Hand`]
  if (!upper || !fore || !hand) return null
  const s = worldPos(upper, new THREE.Vector3())
  const e = worldPos(fore, new THREE.Vector3())
  const w = worldPos(hand, new THREE.Vector3())
  return {
    sign: side === 'Left' ? 1 : -1,
    upper,
    fore,
    hand,
    rest: [upper.quaternion.clone(), fore.quaternion.clone(), hand.quaternion.clone()],
    upperLen: s.distanceTo(e),
    foreLen: e.distanceTo(w),
    ...buildHand(hand, fore),
  }
}

/** Measures both arms; call once, after the seated pose is applied. */
export function buildArms(root, bones) {
  root.updateMatrixWorld(true)
  return { Left: buildArm(bones, 'Left'), Right: buildArm(bones, 'Right') }
}

// ---------------------------------------------------------------------------
// Motion state: what the body is doing, independent of any rig.

const approach = (value, target, rate, dt) => value + (target - value) * (1 - Math.exp(-rate * dt))

export function createBodyMotion(random = Math.random) {
  return {
    random,
    t: 0,
    talk: 0, // eased 0..1, how much the interviewer is currently speaking
    listen: 0,
    lift: { Left: 0, Right: 0 },
    liftGoal: { Left: 0, Right: 0 },
    open: { Left: 0, Right: 0 },
    nextGesture: 0,
    // small hand repositioning between answers, so the hands never freeze in place
    fidget: { Left: new THREE.Vector3(), Right: new THREE.Vector3() },
    fidgetGoal: { Left: new THREE.Vector3(), Right: new THREE.Vector3() },
    nextFidget: 2,
    nod: 0,
    nodStart: -10,
    nextNod: 2.5,
    beat: 0,
  }
}

function pickGesture(m) {
  const roll = m.random()
  // mostly the right hand, sometimes the left, sometimes both, sometimes neither
  const right = roll < 0.45 || (roll >= 0.7 && roll < 0.88)
  const left = (roll >= 0.45 && roll < 0.7) || (roll >= 0.7 && roll < 0.88)
  m.liftGoal.Right = right ? 0.55 + m.random() * 0.45 : 0
  m.liftGoal.Left = left ? 0.5 + m.random() * 0.4 : 0
  m.nextGesture = m.t + 1.3 + m.random() * 1.8
}

/** Advances the body's behaviour by `dt` seconds. Pure state; nothing touches bones here. */
export function updateBodyMotion(m, dt, { speaking = false, listening = false, amplitude = null, scale = 1 } = {}) {
  m.t += dt
  m.talk = approach(m.talk, speaking ? 1 : 0, 3, dt)
  m.listen = approach(m.listen, listening ? 1 : 0, 1.5, dt)

  if (speaking && m.t >= m.nextGesture) pickGesture(m)
  if (!speaking) m.liftGoal.Left = m.liftGoal.Right = 0
  for (const side of ['Left', 'Right']) {
    m.lift[side] = approach(m.lift[side], m.liftGoal[side] * scale, speaking ? 4 : 2.2, dt)
    m.open[side] = approach(m.open[side], m.liftGoal[side] > 0 ? 1 : 0, 3, dt)
  }

  // beats: small downward strokes on stressed syllables, from the speech level when we have it
  const level = amplitude ?? 0.5 + 0.5 * Math.sin(m.t * 5.3) * Math.sin(m.t * 2.1)
  m.beat = approach(m.beat, speaking ? THREE.MathUtils.clamp(level, 0, 1) : 0, 10, dt)

  if (m.t >= m.nextFidget) {
    for (const side of ['Left', 'Right']) {
      m.fidgetGoal[side].set((m.random() - 0.5) * 0.04, m.random() * 0.012, (m.random() - 0.5) * 0.05)
    }
    m.nextFidget = m.t + 3 + m.random() * 5
  }
  for (const side of ['Left', 'Right']) m.fidget[side].lerp(m.fidgetGoal[side], 1 - Math.exp(-1.2 * dt))

  // listening nods: a slow dip and return every few seconds
  if (listening && m.t >= m.nextNod) {
    m.nodStart = m.t
    m.nextNod = m.t + 2.8 + m.random() * 3.5
  }
  const since = m.t - m.nodStart
  m.nod = since < 0.9 ? Math.sin((since / 0.9) * Math.PI) * 0.09 * scale : 0
  return m
}

/** Head offsets to add on top of eye contact. */
export function headOffsets(m, scale = 1) {
  const speech = m.talk * (Math.sin(m.t * 1.9) * 0.025 + m.beat * 0.035)
  return {
    nod: m.nod + speech * scale,
    tilt: (Math.sin(m.t * 0.43) * 0.03 + m.listen * 0.05) * scale,
  }
}

/** Forward lean of the upper body, in radians: leaning in to listen. */
export const leanOf = (m) => m.listen * 0.07 - m.talk * 0.015

// ---------------------------------------------------------------------------
// Applying it to the rig.

const _target = new THREE.Vector3()
const _pole = new THREE.Vector3()
const _palmGoal = new THREE.Vector3()
const _fingerGoal = new THREE.Vector3()
const _s = new THREE.Vector3()
const _w = new THREE.Vector3()
const _elbow = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _n = new THREE.Vector3()
const _axis = new THREE.Vector3()
const _palm = new THREE.Vector3()
const _curl = new THREE.Quaternion()
const _tmp = new THREE.Vector3()

function solveArm(root, arm, m, pose) {
  const side = arm.sign > 0 ? 'Left' : 'Right'
  const lift = m.lift[side]
  const open = m.open[side] * Math.min(1, lift * 2)
  const g = pose.gesture

  arm.upper.quaternion.copy(arm.rest[0])
  arm.fore.quaternion.copy(arm.rest[1])
  arm.hand.quaternion.copy(arm.rest[2])
  arm.upper.updateMatrixWorld(true)

  const beat = -m.beat * lift * 0.025
  _target
    .set(
      arm.sign * (pose.rest.x + g.x * lift),
      pose.rest.y + g.y * lift + beat,
      pose.rest.z + g.z * lift,
    )
    .add(m.fidget[side])
  root.localToWorld(_target)

  worldPos(arm.upper, _s)
  root.worldToLocal(_pole.copy(_s)).add(_tmp.set(arm.sign * pose.pole.x, pose.pole.y, pose.pole.z))
  root.localToWorld(_pole)

  // where the elbow has to be for the hand to reach the target, bent toward the pole
  const a = arm.upperLen
  const b = arm.foreLen
  _dir.subVectors(_target, _s)
  const reach = THREE.MathUtils.clamp(_dir.length(), Math.abs(a - b) + 1e-3, (a + b) * 0.999)
  _dir.normalize()
  _target.copy(_s).addScaledVector(_dir, reach)
  _n.subVectors(_pole, _s).projectOnPlane(_dir).normalize()
  const cos = THREE.MathUtils.clamp((a * a + reach * reach - b * b) / (2 * a * reach), -1, 1)
  _elbow.copy(_s).addScaledVector(_dir, a * cos).addScaledVector(_n, a * Math.sqrt(1 - cos * cos))

  aim(arm.upper, worldPos(arm.fore, _w), _elbow)
  aim(arm.fore, worldPos(arm.hand, _w), _target)

  // forearm roll: palm down and slightly inward at rest, turning to face inward and up in a gesture
  _palmGoal.set(-arm.sign * 0.3, -0.95, 0.05).lerp(_tmp.set(-arm.sign * 0.85, 0.45, 0.25), open)
  root.localToWorld(_palmGoal).sub(root.localToWorld(_tmp.set(0, 0, 0))).normalize()
  _axis.subVectors(_target, _elbow).normalize()
  arm.hand.getWorldQuaternion(_wq)
  _palm.copy(arm.palm).applyQuaternion(_wq)
  const twist = THREE.MathUtils.clamp(angleAround(_palm, _palmGoal, _axis), -MAX_PALM_TWIST, MAX_PALM_TWIST)
  rotateWorld(arm.fore, _q.setFromAxisAngle(_axis, twist * FOREARM_SHARE))
  rotateWorld(arm.hand, _q.setFromAxisAngle(_axis, twist * (1 - FOREARM_SHARE)))

  // wrist: fingers forward and inward along the table, rising a little in a gesture
  _fingerGoal.set(-arm.sign * 0.38, 0.0, 0.92).lerp(_tmp.set(-arm.sign * 0.15, 0.2, 0.97), open)
  root.localToWorld(_fingerGoal).sub(root.localToWorld(_tmp.set(0, 0, 0))).normalize()
  arm.hand.getWorldQuaternion(_wq)
  _palm.copy(arm.along).applyQuaternion(_wq)
  const bend = _palm.angleTo(_fingerGoal)
  _q.setFromUnitVectors(_palm, _fingerGoal)
  if (bend > MAX_WRIST_BEND) _q.copy(_id.identity().slerp(_q, MAX_WRIST_BEND / bend))
  rotateWorld(arm.hand, _q)

  // fingers: relaxed curl, opening during a gesture, each finger a touch different
  arm.fingers.forEach((segments, f) => {
    const spread = 1 + f * 0.12 + Math.sin(m.t * 0.7 + f + arm.sign) * 0.05
    segments.forEach(({ bone, rest, axis }, i) => {
      const amount = THREE.MathUtils.lerp(CURL.rest[i] ?? 0.25, CURL.open[i] ?? 0.08, open) * spread
      bone.quaternion.copy(rest).multiply(_curl.setFromAxisAngle(axis, amount))
    })
  })
  arm.thumb.forEach(({ bone, rest, axis }, i) => {
    if (i === 0) return bone.quaternion.copy(rest)
    bone.quaternion.copy(rest).multiply(_curl.setFromAxisAngle(axis, CURL.thumb * (1 - open * 0.6) * 0.5))
  })
}

/** Poses both arms from the current motion state. Call after the spine has been posed this frame. */
export function applyArms(rig, m, pose = ARM_POSE) {
  if (!rig.arms) return
  rig.root.updateMatrixWorld(true)
  for (const arm of [rig.arms.Left, rig.arms.Right]) if (arm) solveArm(rig.root, arm, m, pose)
}
