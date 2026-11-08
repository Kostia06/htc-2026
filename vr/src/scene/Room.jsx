import { useMemo } from 'react'
import { Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'
import { BoardroomTable, CeilingLight, Credenza, OfficeChair, WallDisplay } from './Furniture.jsx'
import {
  makeCarpetTexture,
  makeNormalMap,
  makeRoughnessMap,
  makeCeilingTileTexture,
  makeFacadeTexture,
  makeSkyTexture,
  makeWallTexture,
  makeWoodTexture,
} from './textures.js'

// A corporate boardroom on an upper floor. The candidate sits at the near edge of
// the table at the origin looking down -Z; the interviewer sits opposite. The
// glazed wall is on +X so daylight rakes across the interviewer's face rather
// than backlighting it — backlight is what made the earlier version read flat.

const X_MIN = -3.0
const X_MAX = 2.7
const Z_MIN = -3.4
const Z_MAX = 2.2
const WALL_H = 2.9

const GLASS_SILL = 0.35 // a floor-to-ceiling wall still has a low kick panel

export function Room() {
  const tex = useRoomTextures()

  return (
    <>
      <Lighting />
      <Floor map={tex.carpet} />
      <Walls map={tex.wall} />
      <Ceiling map={tex.ceiling} />
      <WindowWall />
      <Outside sky={tex.sky} facade={tex.facade} />

      <BoardroomTable position={[0, 0, -0.95]} width={2.9} depth={1.15} map={tex.wood} />

      {/* The interviewer's chair, plus two empty ones so the room reads as a
          boardroom rather than a two-person booth. Chairs are 35 meshes each,
          so the count stays deliberately low. */}
      <OfficeChair position={[0, 0, -1.95]} fabric="#2f343c" />
      <OfficeChair position={[-1.2, 0, -1.9]} rotation={[0, 0.2, 0]} fabric="#2f343c" />
      <OfficeChair position={[1.2, 0, -1.9]} rotation={[0, -0.2, 0]} fabric="#2f343c" />

      <WallDisplay position={[0, 1.62, Z_MIN + 0.06]} width={1.6} height={0.94} />
      <Credenza position={[-1.95, 0, Z_MIN + 0.26]} width={1.7} />

      <CeilingLight position={[-0.9, WALL_H, -1.1]} />
      <CeilingLight position={[1.1, WALL_H, 0.3]} />

      <Tabletop />
    </>
  )
}

// Generated once. Canvas work is cheap but not free, and these never change.
function useRoomTextures() {
  return useMemo(() => {
    const carpet = makeCarpetTexture({ baseColor: '#54565c', fleckColor: '#6b6e76' })
    carpet.repeat.set(12, 12)

    const wall = makeWallTexture({ baseColor: '#9aa0a6' })
    wall.repeat.set(3, 2)

    const ceiling = makeCeilingTileTexture({ baseColor: '#eceae6' })
    ceiling.repeat.set(8, 8)

    const wood = makeWoodTexture({ baseColor: '#9b7448', grainColor: '#5a3f27' })
    wood.repeat.set(2, 1)
    const woodNormal = makeNormalMap(wood, { strength: 1.6 })
    const woodRough = makeRoughnessMap(wood, { base: 0.4, variation: 0.22, invert: true })

    const facade = makeFacadeTexture({ rows: 26, cols: 14 })
    const sky = makeSkyTexture({ topColor: '#8fb4dc', horizonColor: '#e9eef4' })
    return { carpet, wall, ceiling, wood, woodNormal, woodRough, facade, sky }
  }, [])
}

function Lighting() {
  return (
    <>
      <Environment resolution={128}>
        {/* The window wall, as a light. Large and warm. */}
        <Lightformer form="rect" intensity={5.0} color="#fff3e2" scale={[6, 3.2, 1]} position={[5.5, 1.6, -0.6]} rotation={[0, -Math.PI / 2, 0]} />
        <Lightformer form="rect" intensity={1.1} color="#eef3fa" scale={[7, 5, 1]} position={[0, 3.0, -0.5]} rotation={[Math.PI / 2, 0, 0]} />
        <Lightformer form="rect" intensity={0.4} color="#c9d2dd" scale={[6, 3, 1]} position={[-4.5, 1.5, -0.5]} rotation={[0, Math.PI / 2, 0]} />
        <Lightformer form="rect" intensity={0.35} color="#b9a890" scale={[7, 7, 1]} position={[0, -1, 0]} rotation={[-Math.PI / 2, 0, 0]} />
        {/* Bounce back toward the far wall, which otherwise sits in near-black
            and swallows the interviewer's silhouette. */}
        <Lightformer form="rect" intensity={1.5} color="#f0eadf" scale={[7, 3.4, 1]} position={[0, 1.6, 5]} rotation={[0, Math.PI, 0]} />
      </Environment>

      {/* The one shadow caster. A second would halve the framerate in stereo. */}
      <directionalLight
        position={[5.2, 3.4, 0.8]}
        intensity={2.1}
        color="#fff0d6"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
      >
        <orthographicCamera attach="shadow-camera" args={[-3, 3, 3, -3, 0.1, 14]} />
      </directionalLight>

      <hemisphereLight args={['#dce8f7', '#8a7f6f', 0.75]} />
    </>
  )
}

function Floor({ map }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(X_MIN + X_MAX) / 2, 0, (Z_MIN + Z_MAX) / 2]} receiveShadow>
      <planeGeometry args={[X_MAX - X_MIN, Z_MAX - Z_MIN]} />
      <meshStandardMaterial map={map} color="#8d9096" roughness={0.97} />
    </mesh>
  )
}

function Walls({ map }) {
  const w = X_MAX - X_MIN
  const d = Z_MAX - Z_MIN
  const cx = (X_MIN + X_MAX) / 2
  const cz = (Z_MIN + Z_MAX) / 2

  return (
    <group>
      {/* Behind the interviewer: darker, so a face in front of it has contrast. */}
      <mesh position={[cx, WALL_H / 2, Z_MIN]} receiveShadow>
        <planeGeometry args={[w, WALL_H]} />
        <meshStandardMaterial map={map} color="#a9b0b8" roughness={0.94} />
      </mesh>
      <mesh position={[X_MIN, WALL_H / 2, cz]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[d, WALL_H]} />
        <meshStandardMaterial map={map} color="#9aa0a6" roughness={0.94} />
      </mesh>
      <mesh position={[cx, WALL_H / 2, Z_MAX]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[w, WALL_H]} />
        <meshStandardMaterial map={map} color="#9aa0a6" roughness={0.94} />
      </mesh>

      <Skirting />
    </group>
  )
}

function Skirting() {
  const h = 0.1
  return (
    <group position={[0, h / 2, 0]}>
      <mesh position={[(X_MIN + X_MAX) / 2, 0, Z_MIN + 0.015]}>
        <boxGeometry args={[X_MAX - X_MIN, h, 0.03]} />
        <meshStandardMaterial color="#e6e4e0" roughness={0.6} />
      </mesh>
      <mesh position={[X_MIN + 0.015, 0, (Z_MIN + Z_MAX) / 2]}>
        <boxGeometry args={[0.03, h, Z_MAX - Z_MIN]} />
        <meshStandardMaterial color="#e6e4e0" roughness={0.6} />
      </mesh>
    </group>
  )
}

function Ceiling({ map }) {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[(X_MIN + X_MAX) / 2, WALL_H, (Z_MIN + Z_MAX) / 2]}>
      <planeGeometry args={[X_MAX - X_MIN, Z_MAX - Z_MIN]} />
      <meshStandardMaterial map={map} color="#f3f2ef" roughness={1} />
    </mesh>
  )
}

// Full-height glazing on +X, split into bays by dark mullions. The glass is a
// faint tinted plane rather than real refraction — transmission is far too
// expensive for stereo at 72fps and buys nothing at this distance.
function WindowWall() {
  const bays = 4
  const span = Z_MAX - Z_MIN
  const bayWidth = span / bays
  const mullion = '#2c3036'

  return (
    <group position={[X_MAX, 0, 0]}>
      <mesh position={[0, GLASS_SILL / 2, (Z_MIN + Z_MAX) / 2]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[span, GLASS_SILL]} />
        <meshStandardMaterial color="#5b6066" roughness={0.7} />
      </mesh>

      <mesh position={[-0.01, (WALL_H + GLASS_SILL) / 2, (Z_MIN + Z_MAX) / 2]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[span, WALL_H - GLASS_SILL]} />
        <meshStandardMaterial color="#cfe2f0" roughness={0.08} metalness={0.1} transparent opacity={0.16} />
      </mesh>

      {Array.from({ length: bays + 1 }, (_, i) => (
        <mesh key={i} position={[0, (WALL_H + GLASS_SILL) / 2, Z_MIN + i * bayWidth]}>
          <boxGeometry args={[0.1, WALL_H - GLASS_SILL, 0.07]} />
          <meshStandardMaterial color={mullion} roughness={0.45} metalness={0.4} />
        </mesh>
      ))}

      {[GLASS_SILL, WALL_H].map((y) => (
        <mesh key={y} position={[0, y, (Z_MIN + Z_MAX) / 2]}>
          <boxGeometry args={[0.1, 0.07, span]} />
          <meshStandardMaterial color={mullion} roughness={0.45} metalness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, 1.75, (Z_MIN + Z_MAX) / 2]}>
        <boxGeometry args={[0.09, 0.05, span]} />
        <meshStandardMaterial color={mullion} roughness={0.45} metalness={0.4} />
      </mesh>
    </group>
  )
}

// The view. Buildings sit far enough out to give real stereo parallax in the
// headset, which is most of why the window reads as a window.
function Outside({ sky, facade }) {
  const towers = useMemo(
    () => [
      { x: 16, z: -7, w: 7, h: 16 },
      { x: 21, z: 2, w: 8, h: 21 },
      { x: 14, z: 6.5, w: 5.5, h: 11 },
      { x: 27, z: -5, w: 9, h: 27 },
      { x: 12.5, z: -13, w: 6, h: 13 },
      { x: 33, z: 7, w: 10, h: 18 },
    ],
    [],
  )

  return (
    <group>
      <mesh position={[46, 12, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[90, 56]} />
        <meshBasicMaterial map={sky} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[22, -0.02, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshBasicMaterial color="#7c838c" toneMapped={false} />
      </mesh>

      {towers.map((t, i) => (
        <mesh key={i} position={[t.x, t.h / 2, t.z]}>
          <boxGeometry args={[t.w, t.h, t.w]} />
          <meshBasicMaterial map={facade} toneMapped={false} color={i % 2 ? '#c3ccd6' : '#aeb8c4'} />
        </mesh>
      ))}
    </group>
  )
}

// What the interviewer has in front of them.
function Tabletop() {
  const top = 0.752
  return (
    <group>
      <mesh position={[-0.34, top, -1.08]} rotation={[-Math.PI / 2, 0, 0.14]} receiveShadow>
        <planeGeometry args={[0.21, 0.29]} />
        <meshStandardMaterial color="#f7f4ee" roughness={0.92} />
      </mesh>
      <mesh position={[-0.34, top + 0.002, -1.12]} rotation={[-Math.PI / 2, 0, 0.14]}>
        <boxGeometry args={[0.14, 0.004, 0.012]} />
        <meshStandardMaterial color="#2b2f36" roughness={0.5} />
      </mesh>

      <mesh position={[0.46, top + 0.047, -1.02]} castShadow>
        <cylinderGeometry args={[0.038, 0.033, 0.095, 18]} />
        <meshStandardMaterial color="#f2f0ec" roughness={0.25} />
      </mesh>
      <mesh position={[0.5, top + 0.05, -1.02]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.025, 0.006, 8, 16, Math.PI]} />
        <meshStandardMaterial color="#f2f0ec" roughness={0.25} />
      </mesh>
    </group>
  )
}
