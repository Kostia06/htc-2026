import { useMemo } from 'react'
import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'

// Corporate boardroom furniture. Primitives only — no loaded models, no fetches.
// Everything here is pure presentation: it takes position/rotation/scale and
// draws itself. Room.jsx decides where things go.
//
// The one idea that does most of the work: real furniture has no razor-sharp
// edges, so almost nothing is a plain box. RoundedBox everywhere, and the table
// top is an extrusion with a bevelled edge profile.

const WOOD = '#7b5c3f'
const WOOD_EDGE = '#5e4630'
const WOOD_DARK = '#574430'
const PLASTIC = '#23262b'
const PLASTIC_LIGHT = '#33373d'
const STEEL = '#8d949b'
const RUBBER = '#1a1c20'
const CARCASS = '#8d8880'
const CARCASS_DOOR = '#827d75'
const CHROME = '#9fa4aa'
const TRIM = '#ebe8e1'

// ---------------------------------------------------------------- table

const TABLE_H = 0.745
const SLAB = 0.065
const BEVEL = 0.016

// Boat shape: the long edges bow out at the centre and the ends are narrower,
// which is what makes a boardroom table a boardroom table rather than a desk.
function boatShape(width, depth) {
  const hw = width / 2
  const hd = depth / 2
  const end = hd * 0.68
  // Control point chosen so the curve's midpoint lands exactly on hd.
  const bow = 2 * hd - end
  const cap = hw + end * 0.4
  const s = new THREE.Shape()
  s.moveTo(-hw, -end)
  s.quadraticCurveTo(0, -bow, hw, -end)
  s.quadraticCurveTo(cap, 0, hw, end)
  s.quadraticCurveTo(0, bow, -hw, end)
  s.quadraticCurveTo(-cap, 0, -hw, -end)
  return s
}

const EXTRUDE = {
  depth: SLAB,
  bevelEnabled: true,
  bevelThickness: BEVEL,
  bevelSize: BEVEL,
  bevelSegments: 3,
  curveSegments: 12,
}

export function BoardroomTable({ width = 2.8, depth = 1.3, map, ...props }) {
  const shape = useMemo(() => boatShape(width, depth), [width, depth])
  const under = TABLE_H - SLAB - BEVEL * 2
  const plinthX = width * 0.3

  return (
    <group {...props}>
      {/* ExtrudeGeometry gives two material slots: 0 is the flat lid, 1 is the
          bevel plus the side wall. That is how the grain stays on the top face
          and the edge reads as a separate profile. */}
      <mesh position={[0, under + BEVEL, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <extrudeGeometry args={[shape, EXTRUDE]} />
        <meshStandardMaterial
          attach="material-0"
          map={map || null}
          color={map ? '#ffffff' : WOOD}
          roughness={0.19}
          metalness={0.08}
          envMapIntensity={1.4}
        />
        <meshStandardMaterial attach="material-1" color={WOOD_EDGE} roughness={0.38} />
      </mesh>

      {/* Apron / modesty beam. Without it you see straight under the top and it
          collapses into a slab on legs. */}
      <RoundedBox args={[width * 0.7, 0.085, depth * 0.33]} radius={0.012} smoothness={2} position={[0, under - 0.0425, 0]} castShadow>
        <meshStandardMaterial color={WOOD_DARK} roughness={0.62} />
      </RoundedBox>

      {[-plinthX, plinthX].map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          {/* Edge colour, not top colour: when a grain map is supplied the top
              goes its own way and a matching base would clash with it. */}
          <RoundedBox args={[0.11, 0.61, depth * 0.5]} radius={0.016} smoothness={2} position={[0, 0.34, 0]} castShadow receiveShadow>
            <meshStandardMaterial color={WOOD_EDGE} roughness={0.35} />
          </RoundedBox>
          <RoundedBox args={[0.22, 0.038, depth * 0.52]} radius={0.012} smoothness={2} position={[0, 0.019, 0]} castShadow>
            <meshStandardMaterial color={PLASTIC_LIGHT} roughness={0.4} metalness={0.4} />
          </RoundedBox>
        </group>
      ))}

    </group>
  )
}

// ---------------------------------------------------------------- chair

// y, forward offset, width, height. The z offsets run convex at the lumbar and
// concave at the shoulders — that S is what reads as a real backrest.
const BACK_SEGMENTS = [
  [0.06, 0.028, 0.4, 0.15],
  [0.19, 0.015, 0.43, 0.16],
  [0.32, -0.004, 0.42, 0.16],
  [0.45, -0.014, 0.38, 0.15],
  [0.57, -0.022, 0.3, 0.13],
]

export function OfficeChair({ fabric = '#383d45', ...props }) {
  return (
    <group {...props}>
      {/* Backrest, reclined about 10 degrees. */}
      <group position={[0, 0.49, -0.21]} rotation={[-0.17, 0, 0]}>
        {/* Shell behind the padding. Narrower than the cushions and leaning with
            them, so it reads as a frame they are mounted on, not a board. */}
        <RoundedBox args={[0.36, 0.63, 0.04]} radius={0.018} smoothness={2} position={[0, 0.3, -0.05]} rotation={[-0.05, 0, 0]} castShadow>
          <meshStandardMaterial color={PLASTIC} roughness={0.42} metalness={0.2} />
        </RoundedBox>
        {BACK_SEGMENTS.map(([y, z, w, h], i) => (
          <RoundedBox key={i} args={[w, h, 0.075]} radius={0.03} smoothness={3} position={[0, y, z]} castShadow>
            <meshStandardMaterial color={fabric} roughness={0.95} />
          </RoundedBox>
        ))}
      </group>

      {/* Back support arm down to the seat pan. Sits behind the cushion, not
          through it — the rear edge of the seat is where this always clips. */}
      <RoundedBox args={[0.14, 0.2, 0.08]} radius={0.028} smoothness={2} position={[0, 0.4, -0.27]} rotation={[-0.22, 0, 0]} castShadow>
        <meshStandardMaterial color={PLASTIC} roughness={0.45} metalness={0.2} />
      </RoundedBox>

      {/* Seat: cushion on a moulded pan, tilted a couple of degrees forward. */}
      <group rotation={[0.035, 0, 0]}>
        <RoundedBox args={[0.5, 0.1, 0.48]} radius={0.045} smoothness={3} position={[0, 0.42, 0.01]} castShadow receiveShadow>
          <meshStandardMaterial color={fabric} roughness={0.95} />
        </RoundedBox>
        {[-0.215, 0.215].map((x, i) => (
          <RoundedBox key={i} args={[0.07, 0.085, 0.42]} radius={0.034} smoothness={3} position={[x, 0.445, 0.02]} castShadow>
            <meshStandardMaterial color={fabric} roughness={0.95} />
          </RoundedBox>
        ))}
        <RoundedBox args={[0.52, 0.05, 0.5]} radius={0.022} smoothness={2} position={[0, 0.356, 0.01]} castShadow>
          <meshStandardMaterial color={PLASTIC} roughness={0.5} metalness={0.2} />
        </RoundedBox>
      </group>

      {/* Armrests: post up from the pan, padded top. */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <RoundedBox args={[0.045, 0.23, 0.06]} radius={0.016} smoothness={2} position={[s * 0.265, 0.475, -0.02]} rotation={[0, 0, s * -0.07]} castShadow>
            <meshStandardMaterial color={PLASTIC} roughness={0.45} metalness={0.2} />
          </RoundedBox>
          <RoundedBox args={[0.08, 0.04, 0.26]} radius={0.018} smoothness={3} position={[s * 0.275, 0.605, 0.045]} castShadow>
            <meshStandardMaterial color="#1f2227" roughness={0.6} />
          </RoundedBox>
        </group>
      ))}

      {/* Height lever. */}
      <mesh position={[0.235, 0.355, 0.07]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.011, 0.011, 0.1, 8]} />
        <meshStandardMaterial color={STEEL} roughness={0.3} metalness={0.9} />
      </mesh>

      {/* Gas cylinder: a polished piston inside a shroud. Metal, so it is the
          one part of the chair that catches a highlight. */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.19, 12]} />
        <meshStandardMaterial color={PLASTIC} roughness={0.35} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.13, 0]} castShadow>
        <cylinderGeometry args={[0.026, 0.026, 0.2, 12]} />
        <meshStandardMaterial color={STEEL} roughness={0.22} metalness={0.95} />
      </mesh>
      <mesh position={[0, 0.345, 0]} castShadow>
        <cylinderGeometry args={[0.044, 0.044, 0.035, 12]} />
        <meshStandardMaterial color={PLASTIC_LIGHT} roughness={0.5} metalness={0.3} />
      </mesh>

      {/* 5-star base. One arm built once, placed five times. */}
      <mesh position={[0, 0.055, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.075, 0.055, 16]} />
        <meshStandardMaterial color={PLASTIC} roughness={0.45} metalness={0.3} />
      </mesh>
      {Array.from({ length: 5 }, (_, i) => (
        <group key={i} rotation={[0, (i * Math.PI * 2) / 5 + Math.PI / 5, 0]}>
          {/* Tapered, flattened cylinder: wide at the hub, narrow at the castor,
              which is the shape a moulded nylon base actually has. */}
          <mesh position={[0, 0.052, 0.155]} rotation={[Math.PI / 2 + 0.07, 0, 0]} scale={[1, 1, 0.62]} castShadow>
            <cylinderGeometry args={[0.025, 0.055, 0.31, 8]} />
            <meshStandardMaterial color={PLASTIC} roughness={0.45} metalness={0.3} />
          </mesh>
          <mesh position={[0, 0.042, 0.283]} castShadow>
            <cylinderGeometry args={[0.013, 0.013, 0.05, 8]} />
            <meshStandardMaterial color={STEEL} roughness={0.28} metalness={0.95} />
          </mesh>
          <mesh position={[0, 0.028, 0.295]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.028, 0.028, 0.024, 12]} />
            <meshStandardMaterial color={RUBBER} roughness={0.55} metalness={0.1} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------- display

export function WallDisplay({ width = 1.5, height = 0.88, screenColor = '#2c5473', ...props }) {
  return (
    <group {...props}>
      {/* Wall plate and arm, so the panel is not floating against the plaster. */}
      <RoundedBox args={[0.42, 0.26, 0.025]} radius={0.008} smoothness={2} position={[0, 0, -0.075]}>
        <meshStandardMaterial color="#4a4e54" roughness={0.5} metalness={0.4} />
      </RoundedBox>
      <mesh position={[0, 0, -0.045]}>
        <boxGeometry args={[0.22, 0.14, 0.06]} />
        <meshStandardMaterial color="#3a3e44" roughness={0.5} metalness={0.4} />
      </mesh>

      <RoundedBox args={[width, height, 0.032]} radius={0.007} smoothness={2} castShadow>
        <meshStandardMaterial color="#15171a" roughness={0.42} metalness={0.3} />
      </RoundedBox>

      {/* Sits a hair proud of the bezel's front face — the bezel is a solid
          box, so anything behind that face is simply inside it. Unlit, because
          the scene has exactly one shadow-casting light and keeps it that way. */}
      <mesh position={[0, 0.004, 0.0168]}>
        <planeGeometry args={[width - 0.038, height - 0.046]} />
        <meshBasicMaterial color={screenColor} toneMapped={false} />
      </mesh>
      {/* A hint of glass over the top. Cheap, and it stops the screen looking
          like coloured paper. */}
      <mesh position={[0, 0.004, 0.0178]}>
        <planeGeometry args={[width - 0.038, height - 0.046]} />
        <meshStandardMaterial color="#cfe0ef" roughness={0.05} metalness={0.2} transparent opacity={0.09} />
      </mesh>

      <mesh position={[0, -height / 2 + 0.014, 0.0188]}>
        <boxGeometry args={[0.012, 0.004, 0.002]} />
        <meshBasicMaterial color="#7fd39a" toneMapped={false} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------- credenza

export function Credenza({ width = 1.8, depth = 0.46, ...props }) {
  const doorW = (width - 0.05) / 3 - 0.014
  const doorX = (i) => (i - 1) * ((width - 0.05) / 3)

  return (
    <group {...props}>
      {/* Recessed plinth: the shadow gap under it is what lifts the box off the
          carpet instead of letting it sink into it. */}
      <mesh position={[0, 0.045, 0]} castShadow>
        <boxGeometry args={[width - 0.13, 0.09, depth - 0.09]} />
        <meshStandardMaterial color="#2f3338" roughness={0.6} />
      </mesh>

      <RoundedBox args={[width, 0.6, depth]} radius={0.01} smoothness={2} position={[0, 0.39, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={CARCASS} roughness={0.68} />
      </RoundedBox>

      <RoundedBox args={[width + 0.05, 0.038, depth + 0.05]} radius={0.009} smoothness={2} position={[0, 0.708, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={WOOD} roughness={0.34} metalness={0.04} />
      </RoundedBox>

      {[0, 1, 2].map((i) => (
        <group key={i} position={[doorX(i), 0, depth / 2]}>
          <RoundedBox args={[doorW, 0.55, 0.022]} radius={0.006} smoothness={2} position={[0, 0.395, 0.004]} castShadow>
            <meshStandardMaterial color={CARCASS_DOOR} roughness={0.6} />
          </RoundedBox>
          <RoundedBox args={[doorW * 0.56, 0.016, 0.018]} radius={0.007} smoothness={2} position={[0, 0.595, 0.024]} castShadow>
            <meshStandardMaterial color={CHROME} roughness={0.28} metalness={0.85} />
          </RoundedBox>
        </group>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------- ceiling

// Origin sits on the ceiling plane; the troffer hangs below it.
export function CeilingLight({ width = 1.2, depth = 0.32, ...props }) {
  return (
    <group {...props}>
      <mesh position={[0, -0.045, 0]}>
        <boxGeometry args={[width, 0.09, depth]} />
        <meshStandardMaterial color={TRIM} roughness={0.45} />
      </mesh>
      <mesh position={[0, -0.0935, 0]}>
        <boxGeometry args={[width + 0.05, 0.017, depth + 0.05]} />
        <meshStandardMaterial color="#d8d5ce" roughness={0.5} />
      </mesh>
      {/* Lit diffuser only — no light source. It has to hang just below the
          flange, otherwise it is inside the housing and reads as plain trim. */}
      <mesh position={[0, -0.1035, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width - 0.03, depth - 0.03]} />
        <meshBasicMaterial color="#fff3e0" toneMapped={false} />
      </mesh>
    </group>
  )
}
