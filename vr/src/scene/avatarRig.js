// Ready Player Me rigs arrive standing in an A-pose. An interview is seated, and
// a static seated mesh reads as a mannequin, so both the pose and the idle motion
// are applied to the bones at runtime. No animation files, nothing to license.
//
// Bone naming differs per avatar vendor, so nothing here matches on exact strings.
// Ready Player Me shut down in Jan 2026; Avaturn, Mixamo and Rocketbox all name
// bones slightly differently, and hard-coding one vendor is what made us
// vendor-locked in the first place. resolveBones() normalises them instead.

import * as THREE from 'three'

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

  // The GLB is exported in an A-pose, so these are corrections on top of it.
  // Values found by measuring the hand bone's world position, not by eye: the
  // elbow lands within a few millimetres of the table top, so guessing leaves
  // the forearms either buried in it or floating above it.
  LeftShoulder: {},
  RightShoulder: {},
  LeftArm: { tilt: 0.1 },
  RightArm: { tilt: -0.1 },
  LeftForeArm: { nod: -0.6, turn: 0.3 },
  RightForeArm: { nod: -0.6, turn: -0.3 },
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
  const bones = resolveBones(root)
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

  return { bones, morphMeshes, rest, axes, axesByBone, pose: SEATED_POSE }
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

// Breathing, weight shifts and a settling sway. Amplitudes are small on purpose:
// in a headset, motion that looks subtle on a monitor reads as twitchy.
export function applyIdle(rig, t, scale = 1) {
  const { bones, rest, axesByBone } = rig
  if (scale <= 0) return
  const ax = (name) => axesByBone[name] ?? IDENTITY_AXES
  const breath = Math.sin(t * 1.15) * scale // ~11 breaths/min
  const sway = Math.sin(t * 0.37) * scale
  const drift = Math.sin(t * 0.21 + 1.3) * scale

  setSemantic(bones.Spine, rest.Spine, { nod: breath * 0.012, turn: sway * 0.015 }, ax('Spine'))
  setSemantic(bones.Spine1, rest.Spine1, { nod: breath * 0.016, turn: sway * 0.012 }, ax('Spine1'))
  setSemantic(bones.Spine2, rest.Spine2, { nod: breath * 0.01, tilt: drift * 0.01 }, ax('Spine2'))
  setSemantic(bones.LeftShoulder, rest.LeftShoulder, { tilt: breath * 0.02 }, ax('LeftShoulder'))
  setSemantic(bones.RightShoulder, rest.RightShoulder, { tilt: -breath * 0.02 }, ax('RightShoulder'))
}

// Turns the head and eyes toward a world point, clamped so the neck never
// snaps past a plausible range.
const _local = new THREE.Vector3()
const _world = new THREE.Vector3()
const _parentQ = new THREE.Quaternion()
const MAX_YAW = 0.5
const MAX_PITCH = 0.3

export function lookAt(rig, target, delta, weight = 1) {
  const head = rig.bones.Head
  const parent = head?.parent
  if (!head || !parent) return

  // Aim in world space, then write through the rig's own axis convention. The
  // old version set rotation.y/.x directly, which turned a Biped head sideways.
  _world.setFromMatrixPosition(head.matrixWorld)
  _local.copy(target).sub(_world)
  parent.getWorldQuaternion(_parentQ)
  _local.applyQuaternion(_parentQ.invert())

  const axes = rig.axesByBone?.Head ?? rig.axes
  const right = _local[axes.nod.axis] * axes.nod.sign
  const up = _local[axes.turn.axis] * axes.turn.sign
  const forward = _local[axes.tilt.axis] * axes.tilt.sign

  const turn = THREE.MathUtils.clamp(Math.atan2(right, forward), -MAX_YAW, MAX_YAW)
  const nod = THREE.MathUtils.clamp(
    -Math.atan2(up, Math.hypot(right, forward)),
    -MAX_PITCH,
    MAX_PITCH,
  )

  const ease = 1 - Math.pow(0.001, delta) // frame-rate independent smoothing
  easeSemantic(head, rig.rest.Head, { turn: turn * weight, nod: nod * weight }, axes, ease)

  for (const eyeName of ['LeftEye', 'RightEye']) {
    const eye = rig.bones[eyeName]
    if (!eye) continue
    easeSemantic(eye, rig.rest[eyeName], { turn: turn * 0.45, nod: nod * 0.4 }, rig.axesByBone?.[eyeName] ?? axes, ease)
  }
}

function easeSemantic(bone, base, offset, axes, ease) {
  if (!bone || !base) return
  for (const key of ['nod', 'turn', 'tilt']) {
    const amount = offset[key]
    if (amount === undefined) continue
    const { axis, sign } = axes[key]
    bone.rotation[axis] = THREE.MathUtils.lerp(bone.rotation[axis], base[axis] + amount * sign, ease)
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
