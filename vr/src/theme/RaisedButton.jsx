import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { roundedOutline, roundedSlab } from './geometry.js'
import { Label, flat } from './Label.jsx'
import { usePressable } from './usePressable.js'
import { color, ledge as ledges, ledgeOf, radius as radii, size } from './tokens.js'

// The phone's RaisedButtonStyle in 3D: a face on a darker ledge that it sinks
// into when pressed. Sage is the one thing to press; secondary is the quieter
// one beside it.
const TONES = {
  action: { face: color.action, ink: color.onAction },
  secondary: { face: color.secondaryButton, ink: color.text },
  chip: { face: color.chip, ink: color.text },
  negative: { face: color.negative, ink: color.onAction },
}

const glow = new Map()
function glowMaterial(hex) {
  if (!glow.has(hex)) {
    glow.set(hex, new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }))
  }
  return glow.get(hex)
}

export function RaisedButton({
  label,
  onPress,
  tone = 'action',
  width = 0.3,
  height = size.buttonHeight,
  radius = radii.button,
  depth = ledges.button,
  disabled = false,
  busy = false,
  variant = 'headline',
  children,
  reducedMotion,
  ...props
}) {
  const { face, ink } = TONES[tone] ?? TONES.action
  const shownFace = disabled ? color.chip : face
  const { hovered, sink, handlers } = usePressable({ onPress, disabled: disabled || busy, reducedMotion })
  const top = useRef()

  useFrame(() => {
    if (top.current) top.current.position.y = -sink.current.x * depth
  })

  const halo = 0.006
  return (
    <group {...props}>
      <group {...handlers}>
        <mesh geometry={roundedSlab(width, height, radius, size.thickness)} material={flat(ledgeOf(shownFace))} position={[0, -depth, -0.002]} />
        <group ref={top}>
          {hovered && (
            <mesh
              geometry={roundedOutline(width + halo * 2, height + halo * 2, radius + halo, halo)}
              material={glowMaterial(face)}
              position-z={0.0002}
              renderOrder={5}
            />
          )}
          <mesh geometry={roundedSlab(width, height, radius, size.thickness)} material={flat(shownFace)} />
          <group position-z={0.002}>
            {busy ? (
              <Dots tone={ink} reducedMotion={reducedMotion} />
            ) : (
              children ?? (
                <Label variant={variant} tone={disabled ? color.text3 : ink} anchorX="center" anchorY="middle">
                  {label}
                </Label>
              )
            )}
          </group>
        </group>
      </group>
    </group>
  )
}

/** Three dots taking turns, for "working on it". */
export function Dots({ tone = color.text, reducedMotion, ...props }) {
  const dots = useRef([])
  useFrame(({ clock }) => {
    dots.current.forEach((dot, i) => {
      if (!dot) return
      const p = reducedMotion ? 0.5 : (Math.sin(clock.elapsedTime * 5 - i * 0.9) + 1) / 2
      dot.scale.setScalar(0.7 + p * 0.45)
    })
  })
  return (
    <group {...props}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(el) => (dots.current[i] = el)} position={[(i - 1) * 0.02, 0, 0]} material={flat(tone)}>
          <circleGeometry args={[0.0055, 16]} />
        </mesh>
      ))}
    </group>
  )
}
