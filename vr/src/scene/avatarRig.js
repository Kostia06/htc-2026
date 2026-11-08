// Ready Player Me rigs arrive standing in an A-pose. An interview is seated, and
// a static seated mesh reads as a mannequin, so both the pose and the idle motion
// are applied to the bones at runtime. No animation files, nothing to license.
//
// Bone naming differs per avatar vendor, so nothing here matches on exact strings.
// Ready Player Me shut down in Jan 2026; Avaturn, Mixamo and Rocketbox all name
// bones slightly differently, and hard-coding one vendor is what made us
// vendor-locked in the first place. resolveBones() normalises them instead.

import * as THREE from 'three'
import { buildArms } from './bodyMotion.js'

// The rig is authored standing with its feet on y=0, so the whole model drops by
// about a seat height to sit in the chair. Measured against the mesh with
// scripts/mesh-probe.mjs: feet flat on the floor, seat on the cushion.
export const AVATAR_SINK = -0.33

// Tuned against an RPM halfbody-compatible fullbody rig. Values are radians.
// Live-tweak from the console in dev: window.__rig.pose.LeftUpLeg.x = -1.3
// nod = chin toward chest, turn = look left/right, tilt = ear toward shoulder.
// Named by intent, not by euler component: Rocketbox's 3ds Max Biped bones use a
// cyclic permutation of the Mixamo basis, so a literal `{ x: 0.06 }` nods one rig
// and yaws another. resolveAxes() measures each rig's basis instead.
export const SEATED_POSE = {
  Hips: { nod: 0.06 },
  Spine: { nod: -0.04 },
  Spine1: { nod: -0.03 },
  Spine2: { nod: 0.02 },
  Neck: { nod: 0.04 },

  LeftUpLeg: { nod: -1.42, tilt: 0.1 },
  RightUpLeg: { nod: -1.42, tilt: -0.1 },
  LeftLeg: { nod: 1.34 },
  RightLeg: { nod: 1.34 },
  LeftFoot: { nod: 0.12 },
  RightFoot: { nod: 0.12 },

  // Arms are not posed here: bodyMotion.js places them with IK so the forearms
  // rest on the table instead of hanging through it.
}

// Canonical name -> the spellings seen in the wild. Matching is case-insensitive
// and ignores any "mixamorig:" / "Armature|" style prefix.
const BONE_ALIASES = {
  Hips: ['hips', 'pelvis', 'bip01pelvis', 'root'],
  Spine: ['spine', 'bip01spine'],
  Spine1: ['spine1', 'spine_01', 'bip01spine1', 'chest'],
  Spine2: ['spine2', 'spine_02', 'bip01spine2', 'upperchest'],
  Neck: ['neck', 'bip01neck'],
  Head: ['head', 'bip01head'],
  LeftEye: ['lefteye', 'eye_l', 'l_eye', 'bip01leye'],
  RightEye: ['righteye', 'eye_r', 'r_eye', 'bip01reye'],
  LeftShoulder: ['leftshoulder', 'shoulder_l', 'bip01lclavicle', 'leftclavicle'],
  RightShoulder: ['rightshoulder', 'shoulder_r', 'bip01rclavicle', 'rightclavicle'],
  LeftArm: ['leftarm', 'upperarm_l', 'bip01lupperarm', 'leftupperarm'],
  RightArm: ['rightarm', 'upperarm_r', 'bip01rupperarm', 'rightupperarm'],
  LeftForeArm: ['leftforearm', 'lowerarm_l', 'bip01lforearm', 'leftlowerarm'],
  RightForeArm: ['rightforearm', 'lowerarm_r', 'bip01rforearm', 'rightlowerarm'],
  LeftHand: ['lefthand', 'hand_l', 'bip01lhand'],
  RightHand: ['righthand', 'hand_r', 'bip01rhand'],
  LeftUpLeg: ['leftupleg', 'thigh_l', 'bip01lthigh', 'leftthigh', 'leftupperleg'],
  RightUpLeg: ['rightupleg', 'thigh_r', 'bip01rthigh', 'rightthigh', 'rightupperleg'],
  LeftLeg: ['leftleg', 'calf_l', 'bip01lcalf', 'leftlowerleg', 'leftshin'],
  RightLeg: ['rightleg', 'calf_r', 'bip01rcalf', 'rightlowerleg', 'rightshin'],
  LeftFoot: ['leftfoot', 'foot_l', 'bip01lfoot'],
  RightFoot: ['rightfoot', 'foot_r', 'bip01rfoot'],
}

const normalise = (name) =>
  name
    .replace(/^.*[:|]/, '') // strip "mixamorig:" and "Armature|" style prefixes
    .replace(/[\s_.-]/g, '')
    .toLowerCase()

function resolveBones(root) {
  const found = {}
  const byNormalised = new Map()

  root.traverse((node) => {
    if (!node.isBone) return
    const key = normalise(node.name)
    if (!byNormalised.has(key)) byNormalised.set(key, node)
  })

  for (const [canonical, aliases] of Object.entries(BONE_ALIASES)) {
    for (const alias of aliases) {
      const bone = byNormalised.get(alias)
      if (bone) {
        found[canonical] = bone
        break
      }
    }
  }
  return found
}

// Which local euler component actually produces a nod / turn / tilt on this rig,
// and with which sign. Measured from the bone's rest orientation in world space,
// so it works for Mixamo, RPM, Rocketbox Biped and anything else.
const IDENTITY_AXES = {
  nod: { axis: 'x', sign: 1 },
  turn: { axis: 'y', sign: 1 },
  tilt: { axis: 'z', sign: 1 },
}

function resolveAxes(bone) {
  if (!bone) return IDENTITY_AXES

  bone.updateWorldMatrix(true, false)
  const q = new THREE.Quaternion()
  bone.getWorldQuaternion(q)
  const local = {
    x: new THREE.Vector3(1, 0, 0).applyQuaternion(q),
    y: new THREE.Vector3(0, 1, 0).applyQuaternion(q),
    z: new THREE.Vector3(0, 0, 1).applyQuaternion(q),
  }

  const pick = (worldAxis) => {
    let axis = 'x'
    let dot = 0
    for (const [key, vec] of Object.entries(local)) {
      const d = vec.dot(worldAxis)
      if (Math.abs(d) > Math.abs(dot)) {
        dot = d
        axis = key
      }
    }
    return { axis, sign: dot < 0 ? -1 : 1 }
  }

  return {
    nod: pick(new THREE.Vector3(1, 0, 0)),
    turn: pick(new THREE.Vector3(0, 1, 0)),
    tilt: pick(new THREE.Vector3(0, 0, 1)),
  }
}

export function buildRig(root) {
  // The pose below is added on top of the bones' current rotation, so building
  // twice on one model would double it. React StrictMode does exactly that (it
  // runs useMemo twice in dev): thighs turned 163 degrees, knees at the chest.
  // Start every build from the rotations the file shipped with.
  root.traverse((node) => {
    if (!node.isBone) return
    node.userData.bindQuaternion ??= node.quaternion.clone()
    node.quaternion.copy(node.userData.bindQuaternion)
  })
  root.updateMatrixWorld(true)

  const bones = resolveBones(root)
  const gaze = captureGaze(root, bones)
  const morphMeshes = []

  root.traverse((node) => {
    if (node.isMesh || node.isSkinnedMesh) {
      node.frustumCulled = false
      if (node.morphTargetDictionary) morphMeshes.push(node)
    }
  })

  if (import.meta.env?.DEV) {
    const missing = Object.keys(BONE_ALIASES).filter((b) => !bones[b])
    if (missing.length) console.info('[rig] bones not matched:', missing.join(', '))
  }

  // Measured from the rest pose, so this must happen before any offset is applied.
  const axesByBone = {}
  for (const [name, bone] of Object.entries(bones)) {
    axesByBone[name] = resolveAxes(bone)
  }
  const axes = axesByBone.Hips ?? axesByBone.Spine ?? axesByBone.Head ?? IDENTITY_AXES

  // Remember the rest rotation so the idle animation can offset from the pose
  // instead of accumulating drift every frame.
  const rest = {}
  for (const [name, offset] of Object.entries(SEATED_POSE)) {
    const bone = bones[name]
    if (!bone) continue
    addSemantic(bone, offset, axesByBone[name])
  }
  for (const [name, bone] of Object.entries(bones)) {
    rest[name] = bone.rotation.clone()
  }
  const restQuaternion = Object.fromEntries(Object.entries(bones).map(([name, bone]) => [name, bone.quaternion.clone()]))
  const arms = buildArms(root, bones)

  return { root, bones, morphMeshes, rest, restQuaternion, axes, axesByBone, arms, gaze, pose: SEATED_POSE }
}

// Morph target naming is as inconsistent as bone naming. The same ARKit shape
// ships as `eyeBlinkLeft`, `eyeBlink_L` or `eyeblink_l` depending on the
// exporter, and an exact-match lookup silently gives you an avatar that never
// blinks and never opens its mouth — with no error anywhere. Normalise instead.
const normaliseMorph = (name) =>
  name
    .replace(/[\s_.-]/g, '')
    .toLowerCase()
    .replace(/(left|right)$/, (side) => side[0])

// Built once per mesh and cached; this runs for every morph every frame.
function morphIndex(mesh) {
  if (!mesh.userData.__morphIndex) {
    const index = new Map()
    for (const [name, i] of Object.entries(mesh.morphTargetDictionary ?? {})) {
      index.set(normaliseMorph(name), i)
    }
    mesh.userData.__morphIndex = index
  }
  return mesh.userData.__morphIndex
}

export function setMorph(morphMeshes, name, value) {
  const key = normaliseMorph(name)
  for (const mesh of morphMeshes) {
    const index = morphIndex(mesh).get(key)
    if (index === undefined) continue
    mesh.morphTargetInfluences[index] = value
  }
}

// Reads a morph so transitions can ease from wherever they are.
export function getMorph(morphMeshes, name) {
  const key = normaliseMorph(name)
  for (const mesh of morphMeshes) {
    const index = morphIndex(mesh).get(key)
    if (index !== undefined) return mesh.morphTargetInfluences[index]
  }
  return 0
}

export function hasMorph(morphMeshes, name) {
  const key = normaliseMorph(name)
  return morphMeshes.some((mesh) => morphIndex(mesh).get(key) !== undefined)
}

// Breathing, weight shifts and a settling sway. Amplitudes stay small: in a
// headset, motion that looks subtle on a monitor reads as twitchy. Two
// unrelated frequencies per channel so the loop never visibly repeats.
// `lean` tips the upper body forward (radians), e.g. to lean in while listening.
export function applyIdle(rig, t, scale = 1, lean = 0) {
  const { bones, rest, axesByBone } = rig
  if (scale <= 0 && !lean) return
  const ax = (name) => axesByBone[name] ?? IDENTITY_AXES
  const breath = (Math.sin(t * 1.15) * 0.8 + Math.sin(t * 0.53 + 0.4) * 0.2) * scale // ~11 breaths/min
  const sway = (Math.sin(t * 0.37) + Math.sin(t * 0.13 + 2.1) * 0.6) * scale
  const drift = Math.sin(t * 0.21 + 1.3) * scale

  setSemantic(bones.Spine, rest.Spine, { nod: breath * 0.015 + lean * 0.4, turn: sway * 0.02, tilt: drift * 0.012 }, ax('Spine'))
  setSemantic(bones.Spine1, rest.Spine1, { nod: breath * 0.02 + lean * 0.35, turn: sway * 0.015 }, ax('Spine1'))
  setSemantic(bones.Spine2, rest.Spine2, { nod: breath * 0.012 + lean * 0.25, tilt: drift * 0.012 }, ax('Spine2'))
  setSemantic(bones.Neck, rest.Neck, { nod: -lean * 0.5 - breath * 0.008 }, ax('Neck'))
  setSemantic(bones.LeftShoulder, rest.LeftShoulder, { tilt: breath * 0.03 }, ax('LeftShoulder'))
  setSemantic(bones.RightShoulder, rest.RightShoulder, { tilt: -breath * 0.03 }, ax('RightShoulder'))
}

// Eye contact. Aiming is done in the room's frame, from the direction the face
// pointed in the file's standing pose (looking straight ahead). The old version
// measured "up" in the neck's frame; this rig's neck leans ~20 degrees forward,
// so a target level with his eyes read as above him and he lifted his chin 17
// degrees at everyone.
const HEAD_SHARE = 0.75 // the head turns most of the way; the eyes finish the job
const MAX_YAW = 0.6
const MAX_PITCH = 0.35
const MAX_EYE_YAW = 0.3
const MAX_EYE_PITCH = 0.2

const _from = new THREE.Vector3()
const _to = new THREE.Vector3()
const _up = new THREE.Vector3()
const _right = new THREE.Vector3()
const _flatFrom = new THREE.Vector3()
const _flatTo = new THREE.Vector3()
const _pos = new THREE.Vector3()
const _restWorld = new THREE.Quaternion()
const _parentWorld = new THREE.Quaternion()
const _yaw = new THREE.Quaternion()
const _pitch = new THREE.Quaternion()
const _roll = new THREE.Quaternion()
const _goal = new THREE.Quaternion()

function captureGaze(root, bones) {
  root.updateMatrixWorld(true)
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()))
  const gaze = {}
  for (const name of ['Head', 'LeftEye', 'RightEye']) {
    const bone = bones[name]
    if (!bone) continue
    const inverse = bone.getWorldQuaternion(new THREE.Quaternion()).invert()
    gaze[name] = { face: forward.clone().applyQuaternion(inverse) }
  }
  return gaze
}

// Rotation (yaw about room-up, then pitch) that turns `from` toward `to`, scaled and clamped.
function aimRotation(out, from, to, up, share, maxYaw, maxPitch, extraPitch = 0) {
  _flatFrom.copy(from).projectOnPlane(up).normalize()
  _flatTo.copy(to).projectOnPlane(up).normalize()
  const yaw = Math.atan2(up.dot(_right.crossVectors(_flatFrom, _flatTo)), _flatFrom.dot(_flatTo))
  const pitch = Math.asin(THREE.MathUtils.clamp(to.dot(up), -1, 1)) - Math.asin(THREE.MathUtils.clamp(from.dot(up), -1, 1))
  _yaw.setFromAxisAngle(up, THREE.MathUtils.clamp(yaw * share, -maxYaw, maxYaw))
  // pitch about the face's own left-right axis once it has turned; positive looks up
  _right.copy(_flatFrom).applyQuaternion(_yaw).cross(up).normalize()
  _pitch.setFromAxisAngle(_right, THREE.MathUtils.clamp(pitch * share - extraPitch, -maxPitch, maxPitch))
  return out.copy(_pitch).multiply(_yaw)
}

function aimBone(rig, name, target, up, share, maxYaw, maxPitch, ease, extra = {}) {
  const bone = rig.bones[name]
  const gaze = rig.gaze?.[name]
  if (!bone || !gaze) return
  bone.parent.getWorldQuaternion(_parentWorld)
  _restWorld.copy(_parentWorld).multiply(rig.restQuaternion[name])
  _from.copy(gaze.face).applyQuaternion(_restWorld)
  bone.getWorldPosition(_pos)
  _to.copy(target).sub(_pos).normalize()
  aimRotation(_goal, _from, _to, up, share, maxYaw, maxPitch, extra.nod ?? 0)
  if (extra.tilt) _goal.premultiply(_roll.setFromAxisAngle(_to, extra.tilt))
  // world goal back into the bone's local space, then ease toward it
  _goal.multiply(_restWorld).premultiply(_parentWorld.invert())
  bone.quaternion.slerp(_goal, ease)
  bone.updateMatrixWorld(true)
}

// `extra.nod` dips the chin (radians, positive = down) and `extra.tilt` rolls the
// head, on top of eye contact.
export function lookAt(rig, target, delta, weight = 1, extra = {}) {
  if (!rig.bones.Head) return
  rig.root.updateMatrixWorld(true)
  _up.set(0, 1, 0).applyQuaternion(rig.root.getWorldQuaternion(_roll))
  const ease = 1 - Math.pow(0.001, delta) // frame-rate independent smoothing
  aimBone(rig, 'Head', target, _up, HEAD_SHARE * weight, MAX_YAW, MAX_PITCH, ease, extra)
  // eyes start from wherever the head ended up and close the remaining gap
  for (const eye of ['LeftEye', 'RightEye']) {
    aimBone(rig, eye, target, _up, weight, MAX_EYE_YAW, MAX_EYE_PITCH, 1 - Math.pow(0.00001, delta))
  }
}

// Writes semantic offsets onto whichever local components this rig uses.
function setSemantic(bone, base, offset, axes) {
  if (!bone || !base) return
  bone.rotation.copy(base)
  for (const key of ['nod', 'turn', 'tilt']) {
    const amount = offset[key]
    if (!amount) continue
    const { axis, sign } = axes[key]
    bone.rotation[axis] = base[axis] + amount * sign
  }
}

function addSemantic(bone, offset, axes) {
  for (const key of ['nod', 'turn', 'tilt']) {
    const amount = offset[key]
    if (!amount) continue
    const { axis, sign } = axes[key]
    bone.rotation[axis] += amount * sign
  }
}
