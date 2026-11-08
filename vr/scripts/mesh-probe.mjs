// Poses the interviewer's real mesh like the scene does and reports what it touches:
// the chair (seat, armrests, backrest) and the table. Usage: node scripts/mesh-probe.mjs [chairZ] [seconds] [talk|listen|idle]
import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { AVATAR_SINK, buildRig, applyIdle } from '../src/scene/avatarRig.js'
import { INTERVIEWER_CHAIR_Z, INTERVIEWER_Z } from '../src/scene/seating.js'
import { applyArms, createBodyMotion, leanOf, updateBodyMotion } from '../src/scene/bodyMotion.js'

const SINK = AVATAR_SINK
const AT = [0, 0, INTERVIEWER_Z]

// GLTFLoader can't decode images in Node; geometry and skin are all we need
function geometryOnly(path) {
  const d = readFileSync(path)
  const jsonLen = d.readUInt32LE(12)
  const json = JSON.parse(d.subarray(20, 20 + jsonLen).toString())
  const bin = d.subarray(20 + jsonLen + 8)
  delete json.images
  delete json.textures
  delete json.samplers
  json.materials = (json.materials ?? []).map(() => ({}))
  const text = Buffer.from(JSON.stringify(json).padEnd(Math.ceil(JSON.stringify(json).length / 4) * 4, ' '))
  const out = Buffer.alloc(12 + 8 + text.length + 8 + bin.length)
  out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8)
  out.writeUInt32LE(text.length, 12); out.writeUInt32LE(0x4e4f534a, 16); text.copy(out, 20)
  out.writeUInt32LE(bin.length, 20 + text.length); out.writeUInt32LE(0x004e4942, 24 + text.length); bin.copy(out, 28 + text.length)
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.length)
}

// The whole posed body as one static mesh, for ray tests ("can the camera see the chair here?").
export async function posedBody(options = {}) {
  const verts = await posedVertices({ ...options, every: 1 })
  const geometry = new THREE.BufferGeometry().setFromPoints(verts)
  geometry.setIndex(lastIndex)
  lastIndex = []
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
  mesh.userData.verts = verts
  return mesh
}

let lastIndex = []

export async function posedVertices({ seconds = 1, mode = 'idle', every = 2 } = {}) {
  const gltf = await new GLTFLoader().parseAsync(geometryOnly(new URL('../public/avatars/interviewer.glb', import.meta.url)), '')
  const holder = new THREE.Group()
  holder.position.set(AT[0], AT[1] + SINK, AT[2])
  holder.add(gltf.scene)
  holder.updateMatrixWorld(true)
  const rig = buildRig(gltf.scene)
  let seed = 7
  const m = createBodyMotion(() => (seed = (seed * 16807) % 2147483647) / 2147483647)
  const state = { speaking: mode === 'talk', listening: mode === 'listen', amplitude: mode === 'talk' ? 0.7 : null }
  for (let t = 0; t < seconds; t += 1 / 60) updateBodyMotion(m, 1 / 60, state)
  applyIdle(rig, m.t, 1, leanOf(m))
  applyArms(rig, m)
  holder.updateMatrixWorld(true)
  const verts = []
  gltf.scene.traverse((o) => {
    if (!o.isSkinnedMesh) return
    o.skeleton.update()
    const pos = o.geometry.attributes.position
    // the mesh comes in several parts; keep each part's triangles, offset into the merged list
    if (every === 1) for (const k of o.geometry.index.array) lastIndex.push(k + verts.length)
    for (let i = 0; i < pos.count; i += every) {
      const v = new THREE.Vector3()
      o.getVertexPosition(i, v)
      v.applyMatrix4(o.matrixWorld)
      // which bone moves this vertex most, for finding what a stray bit of mesh belongs to
      const si = o.geometry.attributes.skinIndex
      const sw = o.geometry.attributes.skinWeight
      let best = 0
      for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) > sw.getComponent(i, best)) best = k
      v.bone = o.skeleton.bones[si.getComponent(i, best)]?.name
      v.weight = sw.getComponent(i, best)
      v.index = i
      verts.push(v)
    }
  })
  return verts
}

// axis-aligned boxes in world space, from Furniture.jsx's OfficeChair and the table
export function chairBoxes(z) {
  const box = (cx, cy, cz, w, h, d) => new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(cx, cy, cz + z), new THREE.Vector3(w, h, d))
  return {
    armrestPadL: box(0.275, 0.605, 0.045, 0.08, 0.04, 0.26),
    armrestPadR: box(-0.275, 0.605, 0.045, 0.08, 0.04, 0.26),
    armrestPostL: box(0.265, 0.475, -0.02, 0.045, 0.23, 0.06),
    armrestPostR: box(-0.265, 0.475, -0.02, 0.045, 0.23, 0.06),
    seat: box(0, 0.42, 0.01, 0.5, 0.1, 0.48),
  }
}

const isMain = process.argv[1]?.endsWith('mesh-probe.mjs')
if (isMain) {
  const chairZ = process.argv[2] ? Number(process.argv[2]) : INTERVIEWER_CHAIR_Z
  const verts = await posedVertices({ seconds: Number(process.argv[3] ?? 1), mode: process.argv[4] ?? 'idle' })
  const bounds = new THREE.Box3().setFromPoints(verts)
  console.log('body bounds min', bounds.min.toArray().map((x) => x.toFixed(3)).join(' '), 'max', bounds.max.toArray().map((x) => x.toFixed(3)).join(' '))
  const band = (y0, y1) => {
    const s = verts.filter((v) => v.y >= y0 && v.y < y1 && Math.abs(v.x) < 0.2)
    return s.length ? `z ${Math.min(...s.map((v) => v.z)).toFixed(3)}..${Math.max(...s.map((v) => v.z)).toFixed(3)}` : '-'
  }
  console.log('torso back/front at y 0.45-0.55:', band(0.45, 0.55), '| y 0.7-0.8:', band(0.7, 0.8), '| y 0.9-1.0:', band(0.9, 1.0))
  const lowest = verts.filter((v) => Math.abs(v.x) < 0.15 && v.z < -1.55).reduce((a, v) => Math.min(a, v.y), 9)
  console.log('lowest point of seat area (buttocks):', lowest.toFixed(3))
  for (const [name, b] of Object.entries(chairBoxes(chairZ))) {
    const inside = verts.filter((v) => b.containsPoint(v)).length
    console.log(name.padEnd(14), 'vertices inside:', inside)
  }
  const underTable = verts.filter((v) => v.y > 0.66 && v.y < 0.745 && v.z > -1.525 && Math.abs(v.x) < 1.2 && !(v.y > 0.6 && v.z > -1.5 && v.y < 0.7)).length
  const inTableSlab = verts.filter((v) => v.y > 0.68 && v.y < 0.745 && v.z > -1.52 && v.z < -0.4 && Math.abs(v.x) < 1.2).length
  console.log('vertices inside the table slab:', inTableSlab, underTable >= 0 ? '' : '')
}
