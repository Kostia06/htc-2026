import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { createRng } from './textures.js'

// Pot plants, each one instanced mesh of leaves (one draw call per plant,
// not one per leaf: everything renders twice in the headset).
//
// The floor plant used to scale a sphere into a leaf and tilt it about its
// middle, so half of every leaf swung down through the pot and soil and the
// plant read as a burst of green shards. Leaves now pivot at their base, and
// are real blades: tapered at both ends, folded along the midrib, arching
// outward as they grow.

let leafGeometry = null
function bladeGeometry() {
  if (leafGeometry) return leafGeometry
  const geometry = new THREE.PlaneGeometry(1, 1, 2, 10)
  const p = geometry.attributes.position
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) + 0.5 // 0 at the base, 1 at the tip
    const side = p.getX(i) * 2 // -1 .. 1 across the blade
    const width = Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.75) * 0.5
    const x = side * width
    // arch outward (+Z) and a shallow V along the midrib so it catches light
    const z = 0.42 * t * t + Math.abs(side) * width * 0.35
    p.setXYZ(i, x, t, z)
  }
  geometry.computeVertexNormals()
  leafGeometry = geometry
  return geometry
}

const LEAF_GREENS = ['#3f6b3a', '#4f7d43', '#36592f', '#5b8a4c']

/**
 * A potted plant: a ring of long leaves arching out of a pot. `size` 1 is a
 * floor plant about a metre tall; 0.3 sits on a cabinet.
 */
export function Plant({ size = 1, pot = '#e8e4dc', seed = 1, ...props }) {
  const potH = 0.32 * size
  const leaves = useMemo(() => {
    const rng = createRng(seed)
    const count = size > 0.6 ? 16 : 10
    return Array.from({ length: count }, (_, i) => {
      const inner = i % 3 === 0 // a few young leaves stand up in the middle
      return {
        around: (i / count) * Math.PI * 2 + rng() * 0.5,
        lean: inner ? 0.08 + rng() * 0.2 : 0.3 + rng() * 0.45,
        length: (inner ? 0.5 : 0.42) + rng() * 0.3,
        width: 0.11 + rng() * 0.04,
        color: LEAF_GREENS[Math.floor(rng() * LEAF_GREENS.length)],
      }
    })
  }, [size, seed])

  return (
    <group {...props}>
      <mesh position={[0, potH / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.17 * size, 0.13 * size, potH, 20]} />
        <meshStandardMaterial color={pot} roughness={0.55} />
      </mesh>
      <mesh position={[0, potH - 0.01 * size, 0]}>
        <cylinderGeometry args={[0.155 * size, 0.155 * size, 0.01, 20]} />
        <meshStandardMaterial color="#3a2e24" roughness={1} />
      </mesh>
      <Leaves
        geometry={bladeGeometry()}
        base={[0, potH - 0.012 * size, 0]}
        items={leaves.map((leaf) => ({ ...leaf, scale: [leaf.width * size, leaf.length * size, leaf.length * size] }))}
        side={THREE.DoubleSide}
        roughness={0.6}
      />
    </group>
  )
}

/** A small succulent in a concrete pot, for the corner of the table. */
export function TablePlant({ seed = 6, ...props }) {
  const potH = 0.065
  const leaves = useMemo(() => {
    const rng = createRng(seed)
    const rings = [
      { count: 9, lean: 1.15, length: 0.042, y: 0.004 },
      { count: 7, lean: 0.85, length: 0.036, y: 0.008 },
      { count: 5, lean: 0.5, length: 0.028, y: 0.012 },
      { count: 3, lean: 0.25, length: 0.018, y: 0.016 },
    ]
    return rings.flatMap((ring, r) =>
      Array.from({ length: ring.count }, (_, i) => {
        const length = ring.length * (0.9 + rng() * 0.2)
        return {
          around: (i / ring.count) * Math.PI * 2 + r * 0.45 + rng() * 0.2,
          lean: ring.lean + (rng() - 0.5) * 0.15,
          y: ring.y,
          // a fat ellipsoid sitting on its base, so the rosette closes up
          offset: length * 0.55,
          scale: [length * 0.42, length * 0.6, length * 0.16],
          color: ['#7fa48e', '#86ab95', '#749a86', '#8fb29b'][Math.floor(rng() * 4)],
        }
      }),
    )
  }, [seed])
  const sphere = useMemo(() => new THREE.SphereGeometry(1, 12, 8), [])

  return (
    <group {...props}>
      <mesh position={[0, potH / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.052, 0.046, potH, 28]} />
        <meshStandardMaterial color="#bcb7ad" roughness={0.9} />
      </mesh>
      <mesh position={[0, potH - 0.004, 0]}>
        <cylinderGeometry args={[0.046, 0.046, 0.004, 28]} />
        <meshStandardMaterial color="#4a3b2e" roughness={1} />
      </mesh>
      <Leaves geometry={sphere} base={[0, potH - 0.004, 0]} items={leaves} roughness={0.45} />
    </group>
  )
}

const axisY = new THREE.Vector3(0, 1, 0)
const axisX = new THREE.Vector3(1, 0, 0)

// Each leaf: turn `around` the stem, tip outward by `lean` about its base,
// then (optionally) lift by `offset` along its own length and scale.
function Leaves({ geometry, base, items, side = THREE.FrontSide, roughness }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const tilt = new THREE.Quaternion()
    const pos = new THREE.Vector3()
    const color = new THREE.Color()
    items.forEach((leaf, i) => {
      q.setFromAxisAngle(axisY, leaf.around).multiply(tilt.setFromAxisAngle(axisX, leaf.lean))
      pos.set(0, leaf.y ?? 0, 0).add(new THREE.Vector3(0, leaf.offset ?? 0, 0).applyQuaternion(q))
      m.compose(pos, q, new THREE.Vector3(...leaf.scale))
      ref.current.setMatrixAt(i, m)
      ref.current.setColorAt(i, color.set(leaf.color))
    })
    ref.current.instanceMatrix.needsUpdate = true
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [items])

  return (
    <instancedMesh ref={ref} args={[geometry, undefined, items.length]} position={base} castShadow>
      <meshStandardMaterial roughness={roughness} side={side} />
    </instancedMesh>
  )
}
