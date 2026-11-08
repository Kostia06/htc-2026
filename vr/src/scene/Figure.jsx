import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { createFaceDriver } from './lipSync.js'

// A seated interviewer built entirely from primitives. This is what runs when no
// Ready Player Me GLB is present, which is most of the time during development —
// so it is a real character, not a grey box. Stylised on purpose: a half-finished
// realistic human lands in uncanny valley, a clean stylised one reads as a choice.
//
// Authored in local coordinates with the hips already at chair height, so the
// group sits at the chair position with no vertical fudge.

const SKIN = '#c08b6a'
const SKIN_SHADOW = '#a9755a'
const SHIRT = '#8fa6c4'
const JACKET = '#454e5f'
const TROUSER = '#2e333d'
const HAIR = '#2a2320'

const HIP_Y = 0.54
const SHOULDER_Y = 1.03
const NECK_Y = 1.1
const HEAD_Y = 1.238
const HEAD_R = 0.102

// Arms rest on the desk. Desk top is y=0.74 and, relative to the chair, its near
// edge is z=+0.23, so the hands land at z=0.3.
const ARM = {
  left: { shoulder: [0.19, SHOULDER_Y - 0.02, 0], elbow: [0.215, 0.855, 0.07], hand: [0.17, 0.775, 0.3] },
  right: { shoulder: [-0.19, SHOULDER_Y - 0.02, 0], elbow: [-0.215, 0.855, 0.07], hand: [-0.17, 0.775, 0.3] },
}
const LEG = {
  left: { hip: [0.1, HIP_Y - 0.04, 0.02], knee: [0.11, 0.5, 0.36], foot: [0.11, 0.09, 0.4] },
  right: { hip: [-0.1, HIP_Y - 0.04, 0.02], knee: [-0.11, 0.5, 0.36], foot: [-0.11, 0.09, 0.4] },
}

export function Figure({ speaking, listening, getAmplitude, reducedMotion, ...props }) {
  const camera = useThree((s) => s.camera)
  const face = useMemo(() => createFaceDriver(), [])

  const head = useRef()
  const chest = useRef()
  const jaw = useRef()
  const eyes = useRef([])
  const pupils = useRef([])
  const brows = useRef()
  const time = useRef(0)
  const gaze = useRef(new THREE.Vector3())

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30) // a dropped frame must not jolt the pose
    time.current += dt
    const t = time.current
    const damp = reducedMotion ? 0.25 : 1

    const amplitude = speaking ? (getAmplitude?.() ?? null) : null
    const frame = face.update(dt, { speaking, amplitude, listening })

    // Breathing. Tiny on purpose: what looks subtle on a monitor reads as
    // twitching from half a metre away in a headset.
    if (chest.current) {
      const breath = Math.sin(t * 1.15) * damp
      chest.current.scale.set(1 + breath * 0.012, 1 + breath * 0.008, 1 + breath * 0.016)
    }

    // Hold eye contact, with an occasional glance away so it is not a stare.
    if (head.current) {
      gaze.current.copy(camera.position)
      head.current.parent.worldToLocal(gaze.current)
      const glance = Math.sin(t * 0.23) > 0.93 ? 0.22 : 0
      const yaw = THREE.MathUtils.clamp(Math.atan2(gaze.current.x, gaze.current.z), -0.5, 0.5) + glance
      const pitch = THREE.MathUtils.clamp(
        -Math.atan2(gaze.current.y - HEAD_Y, Math.hypot(gaze.current.x, gaze.current.z)),
        -0.3,
        0.3,
      )
      const ease = 1 - Math.pow(0.0015, dt) // frame-rate independent smoothing
      head.current.rotation.y = THREE.MathUtils.lerp(head.current.rotation.y, yaw, ease)
      head.current.rotation.x = THREE.MathUtils.lerp(head.current.rotation.x, pitch, ease)
      head.current.rotation.z = Math.sin(t * 0.31) * 0.02 * damp
    }

    if (jaw.current) {
      const open = frame.jawOpen
      jaw.current.scale.set(1 + open * 0.25, 0.3 + open * 1.9, 1)
      jaw.current.position.y = -0.035 - open * 0.016
    }

    // Blink by squashing the eye, which at this scale is indistinguishable from
    // a lid and costs two meshes instead of ten.
    const openY = 1 - frame.blink
    for (const eye of eyes.current) {
      if (eye) eye.scale.y = Math.max(0.04, openY)
    }
    for (const pupil of pupils.current) {
      if (!pupil) continue
      pupil.scale.y = Math.max(0.04, openY)
      pupil.position.x = pupil.userData.baseX + Math.sin(t * 0.47) * 0.003 * damp
    }
    if (brows.current) {
      brows.current.position.y = 0.045 + frame.browInnerUp * 0.012
    }
  })

  return (
    <group {...props}>
      {/* Seat contact and thighs, mostly hidden by the desk but they stop the
          figure reading as a bust floating above the chair. */}
      <mesh position={[0, HIP_Y - 0.03, 0.04]} castShadow>
        <boxGeometry args={[0.36, 0.14, 0.3]} />
        <meshStandardMaterial color={TROUSER} roughness={0.85} />
      </mesh>
      {Object.values(LEG).map((leg, i) => (
        <group key={i}>
          <Limb from={leg.hip} to={leg.knee} radius={0.072} color={TROUSER} />
          <Limb from={leg.knee} to={leg.foot} radius={0.058} color={TROUSER} />
          <mesh position={[leg.foot[0], 0.035, leg.foot[2] + 0.04]} castShadow>
            <boxGeometry args={[0.095, 0.07, 0.21]} />
            <meshStandardMaterial color="#1d2026" roughness={0.6} />
          </mesh>
        </group>
      ))}

      <group ref={chest}>
        {/* Torso: a tapered cylinder flattened front-to-back, which reads as a
            chest far better than a box and costs one mesh. */}
        <mesh position={[0, (HIP_Y + SHOULDER_Y) / 2, 0]} scale={[1, 1, 0.66]} castShadow>
          <cylinderGeometry args={[0.196, 0.158, SHOULDER_Y - HIP_Y + 0.02, 20, 1]} />
          <meshStandardMaterial color={JACKET} roughness={0.78} />
        </mesh>
        <mesh position={[0, SHOULDER_Y - 0.01, 0]} scale={[1, 0.62, 0.66]} castShadow>
          <sphereGeometry args={[0.196, 22, 14]} />
          <meshStandardMaterial color={JACKET} roughness={0.78} />
        </mesh>

        {/* Shirt placket and collar sitting proud of the jacket. */}
        <mesh position={[0, NECK_Y - 0.042, 0.008]} rotation={[Math.PI / 2 - 0.1, 0, 0]}>
          <torusGeometry args={[0.063, 0.017, 10, 22]} />
          <meshStandardMaterial color={SHIRT} roughness={0.7} />
        </mesh>

        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.185, SHOULDER_Y, 0]} scale={[1, 0.85, 0.72]} castShadow>
            <sphereGeometry args={[0.078, 16, 12]} />
            <meshStandardMaterial color={JACKET} roughness={0.78} />
          </mesh>
        ))}

        {Object.values(ARM).map((arm, i) => (
          <group key={i}>
            <Limb from={arm.shoulder} to={arm.elbow} radius={0.062} color={JACKET} />
            <Limb from={arm.elbow} to={arm.hand} radius={0.05} color={JACKET} />
            <mesh position={arm.hand} scale={[1, 0.62, 1.25]} castShadow>
              <sphereGeometry args={[0.046, 14, 10]} />
              <meshStandardMaterial color={SKIN} roughness={0.72} />
            </mesh>
          </group>
        ))}

        <mesh position={[0, NECK_Y - 0.01, -0.004]} castShadow>
          <cylinderGeometry args={[0.048, 0.058, 0.13, 14]} />
          <meshStandardMaterial color={SKIN_SHADOW} roughness={0.74} />
        </mesh>
      </group>

      <group ref={head} position={[0, HEAD_Y, 0]}>
        <mesh scale={[1, 1.13, 1.02]} castShadow>
          <sphereGeometry args={[HEAD_R, 28, 22]} />
          <meshStandardMaterial color={SKIN} roughness={0.68} />
        </mesh>

        {/* Mouth: scaled rather than hinged. At this size the silhouette change
            is what sells speech, not an anatomically correct jaw. */}
        <mesh ref={jaw} position={[0, -0.042, 0.088]} scale={[1, 0.3, 1]}>
          <capsuleGeometry args={[0.016, 0.014, 4, 12]} />
          <meshStandardMaterial color="#6b3a3c" roughness={0.5} />
        </mesh>

        {/* Cone axis is +Y, so it has to be tipped forward to become a nose. */}
        <mesh position={[0, -0.008, 0.086]} rotation={[Math.PI / 2 - 0.25, 0, 0]} castShadow>
          <coneGeometry args={[0.012, 0.034, 10]} />
          <meshStandardMaterial color={SKIN} roughness={0.7} />
        </mesh>

        {[-1, 1].map((side, i) => (
          <group key={side}>
            <mesh
              ref={(el) => (eyes.current[i] = el)}
              position={[side * 0.038, 0.022, 0.082]}
              scale={[1, 1, 0.6]}
            >
              <sphereGeometry args={[0.019, 14, 12]} />
              <meshStandardMaterial color="#f4f1ec" roughness={0.3} />
            </mesh>
            <mesh
              ref={(el) => {
                pupils.current[i] = el
                if (el) el.userData.baseX = side * 0.038
              }}
              position={[side * 0.038, 0.022, 0.094]}
              scale={[1, 1, 0.5]}
            >
              <sphereGeometry args={[0.0095, 12, 10]} />
              <meshStandardMaterial color="#2b1f18" roughness={0.25} />
            </mesh>
            <mesh position={[side * 0.098, 0.004, 0.004]} scale={[0.5, 1, 0.8]}>
              <sphereGeometry args={[0.024, 10, 8]} />
              <meshStandardMaterial color={SKIN_SHADOW} roughness={0.7} />
            </mesh>
          </group>
        ))}

        <group ref={brows} position={[0, 0.045, 0]}>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.039, 0, 0.082]} rotation={[0, 0, side * -0.14]}>
              <boxGeometry args={[0.038, 0.009, 0.026]} />
              <meshStandardMaterial color={HAIR} roughness={0.85} />
            </mesh>
          ))}
        </group>

        {/* Hair: a slightly larger sphere pushed up and back, cropped by the head
            it sits on. Cheap, and it gives the silhouette a real hairline. */}
        <mesh position={[0, 0.021, -0.012]} scale={[1.06, 1.03, 1.06]} castShadow>
          <sphereGeometry args={[HEAD_R, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
          <meshStandardMaterial color={HAIR} roughness={0.92} />
        </mesh>
        <mesh position={[0, -0.012, -0.042]} scale={[1.02, 1.1, 0.8]}>
          <sphereGeometry args={[HEAD_R * 0.96, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.72]} />
          <meshStandardMaterial color={HAIR} roughness={0.92} />
        </mesh>
      </group>
    </group>
  )
}

// Places a capsule between two points. Keeps the pose readable as coordinates
// rather than a pile of hand-tuned euler angles.
function Limb({ from, to, radius, color }) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from)
    const b = new THREE.Vector3(...to)
    const dir = new THREE.Vector3().subVectors(b, a)
    const len = dir.length()
    return {
      position: new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5),
      quaternion: new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        dir.normalize(),
      ),
      length: Math.max(0.01, len - radius),
    }
  }, [from, to, radius])

  return (
    <mesh position={position} quaternion={quaternion} castShadow>
      <capsuleGeometry args={[radius, length, 4, 12]} />
      <meshStandardMaterial color={color} roughness={0.8} />
    </mesh>
  )
}
