import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { createRng, makeBookSpinesTexture, makeBottleLabelTexture, makeCertificateTexture, makePaintingTexture } from './textures.js'

// The things that make a meeting room look like somebody works there: art on the
// walls, books, plants, a clock, the interviewer's laptop and notes. Mesh counts
// stay low because everything renders twice in the headset.

const FRAME_DARK = '#2a2622'
const FRAME_OAK = '#9a7a52'
const MAT = '#f3f0e8'

/** A framed picture hung on a wall. `map` is a canvas texture; the frame faces +z. */
export function FramedPicture({ map, width, height, frame = FRAME_DARK, mat = 0.05, depth = 0.03, ...props }) {
  const outerW = width + mat * 2 + 0.05
  const outerH = height + mat * 2 + 0.05
  return (
    <group {...props}>
      <RoundedBox args={[outerW, outerH, depth]} radius={0.006} smoothness={2} castShadow>
        <meshStandardMaterial color={frame} roughness={0.5} />
      </RoundedBox>
      {mat > 0 && (
        <mesh position={[0, 0, depth / 2 + 0.001]}>
          <planeGeometry args={[width + mat * 2, height + mat * 2]} />
          <meshStandardMaterial color={MAT} roughness={0.9} />
        </mesh>
      )}
      <mesh position={[0, 0, depth / 2 + 0.002]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial map={map} roughness={0.85} />
      </mesh>
    </group>
  )
}

export function Painting({ style, palette, seed, width = 0.6, height = 0.8, ...props }) {
  const map = useMemo(() => makePaintingTexture({ style, palette, seed, width: width > height ? 512 : 384, height: width > height ? 384 : 512 }), [style, palette, seed, width, height])
  return <FramedPicture map={map} width={width} height={height} {...props} />
}

export function Certificate({ seed, ...props }) {
  const map = useMemo(() => makeCertificateTexture({ seed }), [seed])
  return <FramedPicture map={map} width={0.32} height={0.24} frame={FRAME_OAK} mat={0.025} depth={0.02} {...props} />
}

/** An open bookcase against a wall, front facing +z. */
export function Bookcase({ width = 0.9, height = 1.9, depth = 0.34, shelves = 5, ...props }) {
  const spines = useMemo(() => Array.from({ length: shelves }, (_, i) => makeBookSpinesTexture({ seed: 3 + i * 7 })), [shelves])
  const gap = (height - 0.1) / shelves
  const wood = '#6f5136'
  return (
    <group {...props}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * (width - 0.03)) / 2, height / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.03, height, depth]} />
          <meshStandardMaterial color={wood} roughness={0.55} />
        </mesh>
      ))}
      <mesh position={[0, height / 2, -depth / 2 + 0.01]}>
        <boxGeometry args={[width - 0.04, height, 0.02]} />
        <meshStandardMaterial color="#4e3a28" roughness={0.7} />
      </mesh>
      {Array.from({ length: shelves + 1 }, (_, i) => (
        <mesh key={i} position={[0, 0.05 + i * gap, 0]} castShadow receiveShadow>
          <boxGeometry args={[width - 0.04, 0.025, depth]} />
          <meshStandardMaterial color={wood} roughness={0.55} />
        </mesh>
      ))}
      {spines.map((map, i) => (
        <mesh key={i} position={[0, 0.0625 + i * gap + (gap * 0.78) / 2, depth / 2 - 0.09]}>
          <planeGeometry args={[width - 0.08, gap * 0.78]} />
          <meshStandardMaterial map={map} transparent alphaTest={0.5} roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * A potted plant: a ring of long leaves arching out of a pot. `size` 1 is a
 * floor plant about a metre tall; 0.3 sits on a cabinet.
 */
export function Plant({ size = 1, pot = '#e8e4dc', seed = 1, ...props }) {
  const leaves = useMemo(() => {
    const rng = createRng(seed)
    const count = size > 0.6 ? 14 : 9
    return Array.from({ length: count }, (_, i) => {
      const around = (i / count) * Math.PI * 2 + rng() * 0.4
      const lean = 0.25 + rng() * 0.6
      const length = 0.45 + rng() * 0.35
      return { around, lean, length, shade: ['#3f6b3a', '#4f7d43', '#36592f', '#5b8a4c'][Math.floor(rng() * 4)] }
    })
  }, [size, seed])
  const potH = 0.32 * size
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
      {leaves.map(({ around, lean, length, shade }, i) => (
        <group key={i} position={[0, potH, 0]} rotation={[0, around, 0]}>
          <mesh position={[0, (length * size) / 2, 0]} rotation={[lean, 0, 0]} scale={[0.07 * size, (length * size) / 2, 0.012 * size]} castShadow>
            <sphereGeometry args={[1, 10, 8]} />
            <meshStandardMaterial color={shade} roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** A wall clock showing the viewer's real time. Faces +z. */
export function WallClock({ radius = 0.16, ...props }) {
  const hour = useRef()
  const minute = useRef()
  useFrame(() => {
    const now = new Date()
    const m = now.getMinutes() + now.getSeconds() / 60
    const h = (now.getHours() % 12) + m / 60
    if (minute.current) minute.current.rotation.z = -(m / 60) * Math.PI * 2
    if (hour.current) hour.current.rotation.z = -(h / 12) * Math.PI * 2
  })
  return (
    <group {...props}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[radius, radius, 0.035, 40]} />
        <meshStandardMaterial color="#1f2125" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.018]}>
        <circleGeometry args={[radius * 0.9, 40]} />
        <meshStandardMaterial color="#f6f4ef" roughness={0.8} />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => (
        <group key={i} rotation={[0, 0, (i / 12) * Math.PI * 2]}>
          <mesh position={[0, radius * 0.76, 0.02]}>
            <planeGeometry args={[i % 3 ? 0.006 : 0.012, i % 3 ? 0.02 : 0.035]} />
            <meshBasicMaterial color="#2a2c30" />
          </mesh>
        </group>
      ))}
      <group ref={hour} position={[0, 0, 0.022]}>
        <mesh position={[0, radius * 0.25, 0]}>
          <planeGeometry args={[0.012, radius * 0.5]} />
          <meshBasicMaterial color="#1c1d20" />
        </mesh>
      </group>
      <group ref={minute} position={[0, 0, 0.024]}>
        <mesh position={[0, radius * 0.36, 0]}>
          <planeGeometry args={[0.008, radius * 0.72]} />
          <meshBasicMaterial color="#1c1d20" />
        </mesh>
      </group>
    </group>
  )
}

// ---------------------------------------------------------------- on the table

// A 500 mL bottle in metres: petal base, two grip rings, label panel, a
// shoulder curving into the neck, and the support ring under the cap.
const BOTTLE = [
  [0, 0.002], [0.022, 0.0], [0.03, 0.003], [0.033, 0.01], [0.033, 0.026], [0.0312, 0.03], [0.033, 0.034],
  [0.033, 0.118], [0.0312, 0.122], [0.033, 0.126], [0.0328, 0.14], [0.03, 0.158], [0.022, 0.175],
  [0.0145, 0.186], [0.0135, 0.192], [0.0168, 0.193], [0.0168, 0.1955], [0.0135, 0.1965], [0.0135, 0.2],
].map(([x, y]) => new THREE.Vector2(x, y))
const FILL = 0.168
// the water follows the inside of the bottle up into the shoulder
const BOTTLE_WATER = [
  [0, 0.003], [0.0215, 0.0015], [0.0295, 0.0045], [0.0322, 0.011], [0.0322, 0.14], [0.0295, 0.157], [0.0245, FILL], [0, FILL],
].map(([x, y]) => new THREE.Vector2(x, y))
const LABEL = { bottom: 0.04, height: 0.072, radius: 0.0334 }

/**
 * A sealed bottle of SkilliT water. The water refracts what's behind it
 * (transmission, one shared pass for every bottle); the PET shell is a thin,
 * glossy, mostly see-through layer drawn after it; the label is opaque print
 * wrapped round the middle.
 */
export function WaterBottle({ brand = 'SkilliT', cap = '#1d5fa8', ...props }) {
  const shell = useMemo(() => new THREE.LatheGeometry(BOTTLE, 56), [])
  const water = useMemo(() => new THREE.LatheGeometry(BOTTLE_WATER, 56), [])
  const label = useMemo(() => makeBottleLabelTexture({ brand }), [brand])
  return (
    <group {...props}>
      <mesh geometry={water}>
        <meshPhysicalMaterial
          transmission={1}
          thickness={0.06}
          ior={1.333}
          roughness={0}
          metalness={0}
          color="#ffffff"
          attenuationColor="#d4ecf2"
          attenuationDistance={0.35}
          envMapIntensity={1.2}
        />
      </mesh>
      <mesh geometry={shell} renderOrder={2}>
        <meshPhysicalMaterial
          color="#f4fbff"
          transparent
          opacity={0.16}
          roughness={0.04}
          metalness={0}
          ior={1.57}
          clearcoat={1}
          clearcoatRoughness={0.02}
          envMapIntensity={2}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* label starts at theta = PI so the wordmark (u = 0.5) faces +z */}
      <mesh position={[0, LABEL.bottom + LABEL.height / 2, 0]} castShadow>
        <cylinderGeometry args={[LABEL.radius, LABEL.radius, LABEL.height, 56, 1, true, Math.PI, Math.PI * 2]} />
        <meshStandardMaterial map={label} roughness={0.42} side={THREE.DoubleSide} />
      </mesh>
      {/* cap: 28 flat facets catch the light like the ribs on a real cap */}
      <mesh position={[0, 0.2085, 0]} castShadow>
        <cylinderGeometry args={[0.0152, 0.0152, 0.017, 28]} />
        <meshStandardMaterial color={cap} roughness={0.38} flatShading />
      </mesh>
    </group>
  )
}

/** A small succulent in a concrete pot, for the corner of the table. */
export function TablePlant({ seed = 6, ...props }) {
  const leaves = useMemo(() => {
    const rng = createRng(seed)
    const rings = [
      { count: 9, lean: 1.15, length: 0.042, y: 0.004 },
      { count: 7, lean: 0.85, length: 0.036, y: 0.008 },
      { count: 5, lean: 0.5, length: 0.028, y: 0.012 },
      { count: 3, lean: 0.25, length: 0.018, y: 0.016 },
    ]
    return rings.flatMap((ring, r) =>
      Array.from({ length: ring.count }, (_, i) => ({
        around: (i / ring.count) * Math.PI * 2 + r * 0.45 + rng() * 0.2,
        lean: ring.lean + (rng() - 0.5) * 0.15,
        length: ring.length * (0.9 + rng() * 0.2),
        y: ring.y,
        color: ['#7fa48e', '#86ab95', '#749a86', '#8fb29b'][Math.floor(rng() * 4)],
      })),
    )
  }, [seed])
  const potH = 0.065
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
      {leaves.map(({ around, lean, length, y, color }, i) => (
        <group key={i} position={[0, potH + y - 0.004, 0]} rotation={[0, around, 0]}>
          <group rotation={[lean, 0, 0]}>
            <mesh position={[0, length * 0.55, 0]} scale={[length * 0.42, length * 0.6, length * 0.16]} castShadow>
              <sphereGeometry args={[1, 12, 8]} />
              <meshStandardMaterial color={color} roughness={0.45} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  )
}

// Folder colours seen in any office supply cupboard.
const FOLDERS = ['#d6b47f', '#3f6e9e', '#8a9097', '#6d8c68', '#a6523f', '#d6b47f', '#4b5a72']

/**
 * A stepped desk file sorter: three slots, each taller than the one in front, so
 * every folder's tab shows. Folders lean back a little and carry paper inside.
 * The front faces +z.
 */
export function FileHolder({ seed = 4, ...props }) {
  const width = 0.25
  const slots = [
    { z: 0.05, wall: 0.1 },
    { z: 0, wall: 0.14 },
    { z: -0.05, wall: 0.18 },
  ]
  const files = useMemo(() => {
    const rng = createRng(seed)
    return slots.flatMap((slot, s) =>
      Array.from({ length: s === 0 ? 2 : 3 }, (_, i) => ({
        z: slot.z - 0.012 - i * 0.009,
        // a little lean back, never enough to pass through the wall behind
        lean: -0.03 - rng() * 0.04,
        color: FOLDERS[Math.floor(rng() * FOLDERS.length)],
        tab: (rng() - 0.5) * 0.14,
        papers: 1 + Math.floor(rng() * 3),
        rise: 0.004 + rng() * 0.012,
        height: 0.2 + s * 0.035 + rng() * 0.01,
      })),
    )
  }, [seed])
  const metal = '#34373c'
  return (
    <group {...props}>
      <mesh position={[0, 0.003, -0.012]} castShadow receiveShadow>
        <boxGeometry args={[width, 0.006, 0.18]} />
        <meshStandardMaterial color={metal} roughness={0.45} metalness={0.6} />
      </mesh>
      {/* the front wall of each slot, plus a back wall */}
      {[...slots, { z: -0.12, wall: 0.2 }].map(({ z, wall }, i) => (
        <mesh key={i} position={[0, wall / 2, z + 0.02]} castShadow receiveShadow>
          <boxGeometry args={[width, wall, 0.004]} />
          <meshStandardMaterial color={metal} roughness={0.45} metalness={0.6} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * (width - 0.004)) / 2, 0.1, -0.012]} castShadow>
          <boxGeometry args={[0.004, 0.2, 0.18]} />
          <meshStandardMaterial color={metal} roughness={0.45} metalness={0.6} />
        </mesh>
      ))}
      {files.map((file, i) => (
        <group key={i} position={[0, 0.006, file.z]} rotation={[file.lean, 0, 0]}>
          {/* the folder: two covers with paper between, and a tab on top */}
          <mesh position={[0, file.height / 2, 0]} castShadow>
            <boxGeometry args={[width - 0.02, file.height, 0.0035]} />
            <meshStandardMaterial color={file.color} roughness={0.85} />
          </mesh>
          <mesh position={[file.tab, file.height + 0.008, 0]}>
            <boxGeometry args={[0.06, 0.016, 0.0035]} />
            <meshStandardMaterial color={file.color} roughness={0.85} />
          </mesh>
          {Array.from({ length: file.papers }, (_, p) => (
            <mesh key={p} position={[(p - 1) * 0.004, file.height / 2 + file.rise - p * 0.003, 0.0026 + p * 0.0007]}>
              <boxGeometry args={[width - 0.035, file.height - 0.01, 0.0006]} />
              <meshStandardMaterial color="#f7f5ef" roughness={0.9} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}
