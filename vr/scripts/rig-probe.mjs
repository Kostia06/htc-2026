// Prints where the interviewer's joints land in the room after buildRig + one idle frame.
import { readFileSync } from 'node:fs'
import * as THREE from 'three'

const rigModule = await import('../src/scene/avatarRig.js')
const { INTERVIEWER_Z } = await import('../src/scene/seating.js')
const body = await import('../src/scene/bodyMotion.js')
const SINK = rigModule.AVATAR_SINK, AT = new THREE.Vector3(0, 0, INTERVIEWER_Z)

export function loadSkeleton(path = new URL('../public/avatars/interviewer.glb', import.meta.url)) {
  const d = readFileSync(path)
  const len = d.readUInt32LE(12)
  const g = JSON.parse(d.subarray(20, 20 + len).toString())
  const objs = g.nodes.map((n) => {
    const o = n.mesh !== undefined ? new THREE.Object3D() : new THREE.Bone()
    o.name = n.name
    if (n.translation) o.position.fromArray(n.translation)
    if (n.rotation) o.quaternion.fromArray(n.rotation)
    if (n.scale) o.scale.fromArray(n.scale)
    return o
  })
  g.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => objs[i].add(objs[c])))
  const holder = new THREE.Group()
  holder.position.set(AT.x, AT.y + SINK, AT.z)
  const scene = new THREE.Group()
  g.scenes[0].nodes.forEach((i) => scene.add(objs[i]))
  holder.add(scene)
  holder.updateMatrixWorld(true)
  return { holder, scene }
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())
if (isMain) {
  const { holder, scene } = loadSkeleton()
  const rig = rigModule.buildRig(scene)
  // usage: node scripts/rig-probe.mjs [seconds] [talk|listen|idle]
  const seconds = Number(process.argv[2] ?? 0)
  const mode = process.argv[3] ?? 'idle'
  let seed = 7
  const motion = body.createBodyMotion(() => ((seed = (seed * 16807) % 2147483647) / 2147483647))
  const state = { speaking: mode === 'talk', listening: mode === 'listen', amplitude: mode === 'talk' ? 0.7 : null }
  for (let t = 0; t < seconds; t += 1 / 60) body.updateBodyMotion(motion, 1 / 60, state)
  rigModule.applyIdle(rig, motion.t, 1, body.leanOf(motion))
  body.applyArms(rig, motion)
  holder.updateMatrixWorld(true)
  console.log('lift', motion.lift, 'open', motion.open)
  const p = new THREE.Vector3()
  const show = (n) => {
    const b = rig.bones[n]
    if (!b) return console.log(n.padEnd(14), 'missing')
    b.getWorldPosition(p)
    console.log(n.padEnd(14), p.toArray().map((v) => v.toFixed(3).padStart(7)).join(' '))
  }
  console.log('table top y=0.745, far edge z≈-1.525 (interviewer side), x span ±1.45')
  ;['Hips', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand', 'LeftLeg', 'LeftFoot'].forEach(show)
  for (const side of ['Left', 'Right']) {
    const arm = rig.arms[side]
    const q = arm.hand.getWorldQuaternion(new THREE.Quaternion())
    const f = (v) => v.clone().applyQuaternion(q).toArray().map((x) => x.toFixed(2)).join(' ')
    const tip = arm.fingers[1].at(-1).bone.getWorldPosition(new THREE.Vector3())
    console.log(side, 'palm faces', f(arm.palm), '| fingers point', f(arm.along), '| middle tip', tip.toArray().map((x) => x.toFixed(3)).join(' '))
  }
}
