import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { loadSkeleton } from '../../scripts/rig-probe.mjs'
import { chairBoxes, posedVertices } from '../../scripts/mesh-probe.mjs'
import { INTERVIEWER_CHAIR_Z, INTERVIEWER_EYE_Y } from './seating.js'
import { applyIdle, buildRig, lookAt } from './avatarRig.js'
import { applyArms, createBodyMotion, leanOf, updateBodyMotion } from './bodyMotion.js'

const TABLE_TOP = 0.745

function seeded(seed = 7) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647
}

function run(seconds, state) {
  const { holder, scene } = loadSkeleton()
  const rig = buildRig(scene)
  const motion = createBodyMotion(seeded())
  for (let t = 0; t < seconds; t += 1 / 60) updateBodyMotion(motion, 1 / 60, state)
  applyIdle(rig, motion.t, 1, leanOf(motion))
  applyArms(rig, motion)
  holder.updateMatrixWorld(true)
  const at = (bone) => bone.getWorldPosition(new THREE.Vector3())
  return { rig, motion, at }
}

// Against the real interviewer GLB: a hand that hangs through the table is
// exactly the bug this module exists to fix.
describe('seated arms on the interviewer avatar', () => {
  it('rests both hands on the table, not under it', () => {
    const { rig, at } = run(1, {})
    for (const arm of [rig.arms.Left, rig.arms.Right]) {
      expect(at(arm.hand).y).toBeGreaterThan(TABLE_TOP)
      expect(at(arm.hand).y).toBeLessThan(TABLE_TOP + 0.08)
      expect(at(arm.fore).y).toBeGreaterThan(TABLE_TOP)
    }
  })

  it('keeps the bones their real length, so nothing stretches', () => {
    const { rig, at } = run(1, {})
    const arm = rig.arms.Right
    expect(at(arm.upper).distanceTo(at(arm.fore))).toBeCloseTo(arm.upperLen, 4)
    expect(at(arm.fore).distanceTo(at(arm.hand))).toBeCloseTo(arm.foreLen, 4)
  })

  it('turns the resting palms toward the table', () => {
    const { rig } = run(1, {})
    for (const arm of [rig.arms.Left, rig.arms.Right]) {
      const palm = arm.palm.clone().applyQuaternion(arm.hand.getWorldQuaternion(new THREE.Quaternion()))
      expect(palm.y).toBeLessThan(-0.6)
    }
  })

  it('lifts a hand off the table while talking and puts it back after', () => {
    const talking = run(3, { speaking: true, amplitude: 0.7 })
    const lifted = Math.max(talking.motion.lift.Left, talking.motion.lift.Right)
    expect(lifted).toBeGreaterThan(0.3)

    const motion = talking.motion
    for (let t = 0; t < 4; t += 1 / 60) updateBodyMotion(motion, 1 / 60, { speaking: false })
    expect(Math.max(motion.lift.Left, motion.lift.Right)).toBeLessThan(0.02)
  })
})

describe('building the rig', () => {
  // StrictMode builds it twice on the same model in dev; the second build used to
  // stack the seated pose again and fold his knees up to his chest.
  it('gives the same pose however many times it is built', () => {
    const { holder, scene } = loadSkeleton()
    const at = (rig, name) => rig.bones[name].getWorldPosition(new THREE.Vector3())
    const once = buildRig(scene)
    holder.updateMatrixWorld(true)
    const knee = at(once, 'LeftLeg').clone()
    const foot = at(once, 'LeftFoot').clone()
    const twice = buildRig(scene)
    holder.updateMatrixWorld(true)
    expect(at(twice, 'LeftLeg').distanceTo(knee)).toBeLessThan(1e-6)
    expect(at(twice, 'LeftFoot').distanceTo(foot)).toBeLessThan(1e-6)
  })

  it('seats him with knees below the table and feet forward on the floor', () => {
    const { holder, scene } = loadSkeleton()
    buildRig(scene)
    const rig = buildRig(scene)
    holder.updateMatrixWorld(true)
    const hip = rig.bones.LeftUpLeg.getWorldPosition(new THREE.Vector3())
    const knee = rig.bones.LeftLeg.getWorldPosition(new THREE.Vector3())
    const foot = rig.bones.LeftFoot.getWorldPosition(new THREE.Vector3())
    expect(knee.y).toBeLessThan(0.6)
    expect(knee.z - hip.z).toBeGreaterThan(0.3) // thigh runs forward, not up
    expect(foot.y).toBeLessThan(0.15)
  })
})

describe('body language', () => {
  it('leans in while listening', () => {
    const m = createBodyMotion(seeded())
    for (let t = 0; t < 4; t += 1 / 60) updateBodyMotion(m, 1 / 60, { listening: true })
    expect(leanOf(m)).toBeGreaterThan(0.05)
  })

  it('nods every few seconds while listening, never while idle', () => {
    const nods = (state) => {
      const m = createBodyMotion(seeded())
      let count = 0
      let was = false
      for (let t = 0; t < 20; t += 1 / 60) {
        updateBodyMotion(m, 1 / 60, state)
        const now = m.nod > 0.05
        if (now && !was) count++
        was = now
      }
      return count
    }
    expect(nods({ listening: true })).toBeGreaterThanOrEqual(3)
    expect(nods({})).toBe(0)
  })

  it('scales gestures down for reduced motion', () => {
    const full = createBodyMotion(seeded())
    const reduced = createBodyMotion(seeded())
    for (let t = 0; t < 3; t += 1 / 60) {
      updateBodyMotion(full, 1 / 60, { speaking: true })
      updateBodyMotion(reduced, 1 / 60, { speaking: true, scale: 0.25 })
    }
    const peak = (m) => Math.max(m.lift.Left, m.lift.Right)
    expect(peak(reduced)).toBeLessThan(peak(full) * 0.4)
  })
})

// The real skinned mesh, posed the way the scene poses it. Screenshots caught
// hands sinking into the table and the chair floating behind him; this keeps it fixed.
describe('the interviewer mesh against the furniture', () => {
  const TABLE_EDGE_Z = -1.525
  const TABLE_UNDERSIDE = 0.648

  it.each([
    ['resting', { seconds: 1, mode: 'idle' }],
    ['listening', { seconds: 6, mode: 'listen' }],
    ['talking', { seconds: 3, mode: 'talk' }],
  ])('stays out of the table top while %s', async (_label, state) => {
    const verts = await posedVertices(state)
    const inTable = verts.filter((v) => v.y > TABLE_UNDERSIDE && v.y < TABLE_TOP && v.z > TABLE_EDGE_Z && Math.abs(v.x) < 1.2)
    expect(inTable).toHaveLength(0)
  })

  it('has his feet on the floor, not through it', async () => {
    const lowest = Math.min(...(await posedVertices({})).map((v) => v.y))
    expect(lowest).toBeGreaterThan(-0.01)
    expect(lowest).toBeLessThan(0.02)
  })

  it('sits in the chair without touching the armrests', async () => {
    const verts = await posedVertices({})
    const chair = chairBoxes(INTERVIEWER_CHAIR_Z)
    for (const part of ['armrestPadL', 'armrestPadR', 'armrestPostL', 'armrestPostR']) {
      expect(verts.filter((v) => chair[part].containsPoint(v))).toHaveLength(0)
    }
    // on the cushion, squashing it a little, not floating above or sunk into it
    const seat = Math.min(...verts.filter((v) => Math.abs(v.x) < 0.15 && v.z < INTERVIEWER_CHAIR_Z + 0.2).map((v) => v.y))
    expect(seat).toBeGreaterThan(0.44)
    expect(seat).toBeLessThan(0.475)
  })
})

// The interview is face to face: he should hold eye contact with the candidate
// sitting across the table, not lift his chin above them.
describe('eye contact', () => {
  const settle = (target, extra) => {
    const { holder, scene } = loadSkeleton()
    const rig = buildRig(scene)
    holder.updateMatrixWorld(true)
    for (let i = 0; i < 240; i++) {
      applyIdle(rig, i / 60, 1, 0)
      lookAt(rig, target, 1 / 60, 1, extra)
      holder.updateMatrixWorld(true)
    }
    const eyes = rig.bones.LeftEye.getWorldPosition(new THREE.Vector3()).add(rig.bones.RightEye.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5)
    const facing = (name) => rig.gaze[name].face.clone().applyQuaternion(rig.bones[name].getWorldQuaternion(new THREE.Quaternion()))
    const needed = target.clone().sub(eyes).normalize()
    return { eyes, head: facing('Head'), eye: facing('LeftEye'), needed }
  }
  const degrees = (a, b) => (a.angleTo(b) * 180) / Math.PI

  it('puts the candidate level with his actual eyes', () => {
    expect(settle(new THREE.Vector3(0, INTERVIEWER_EYE_Y, 0.1)).eyes.y).toBeCloseTo(INTERVIEWER_EYE_Y, 1)
  })

  it.each([
    ['straight across', [0, INTERVIEWER_EYE_Y, 0.1]],
    ['sitting lower', [0, INTERVIEWER_EYE_Y - 0.15, 0.1]],
    ['leaning to one side', [0.4, INTERVIEWER_EYE_Y, 0.1]],
  ])('looks the candidate in the eye when they are %s', (_label, at) => {
    const { head, eye, needed } = settle(new THREE.Vector3(...at))
    expect(degrees(eye, needed)).toBeLessThan(2)
    expect(degrees(head, needed)).toBeLessThan(5)
    // never chin-up at someone level with or below him (the old bug was 17 degrees up)
    expect(head.y).toBeLessThan(Math.max(needed.y, 0) + 0.035)
  })
})
