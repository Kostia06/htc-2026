import { useMemo } from 'react'
import * as THREE from 'three'
import { Surface } from './Card.jsx'
import { Label } from './Label.jsx'
import { logoTexture } from './logo.js'
import { color, type } from './tokens.js'

// Troika measures text asynchronously; a chip has to size itself now, so this
// is Inter's average advance at the given size. Close enough for padding.
const estimateWidth = (text, fontSize) => text.length * fontSize * 0.56

/** A capsule label sitting on a card: "Example data", a role, a status. */
export function Chip({ text, face = color.chip, tone = 'text', variant = 'footnote', dot, ...props }) {
  const fontSize = type[variant]
  const height = fontSize * 2.1
  const dotSpace = dot ? fontSize * 1.1 : 0
  const width = estimateWidth(text, fontSize) + height * 0.9 + dotSpace
  return (
    <group {...props}>
      <Surface width={width} height={height} radius={height / 2} face={face} />
      {dot && (
        <mesh position={[-width / 2 + height * 0.45 + fontSize * 0.3, 0, 0.001]}>
          <circleGeometry args={[fontSize * 0.3, 16]} />
          <meshBasicMaterial color={dot} toneMapped={false} />
        </mesh>
      )}
      <Label variant={variant} weight="semibold" tone={tone} anchorX="center" anchorY="middle" position={[dotSpace / 2, 0, 0.001]}>
        {text}
      </Label>
    </group>
  )
}

/**
 * Required, not decoration: anything from the stub must say so in the headset
 * as well as on the desktop.
 */
export function ExampleBadge(props) {
  return <Chip text="Example data" face={color.inset} tone="agent" dot={color.agent} {...props} />
}

/** The app icon as a flat square, `size` metres wide. */
export function Logo({ size = 0.06, ...props }) {
  const map = useMemo(() => logoTexture(256), [])
  return (
    <mesh {...props}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={map} transparent alphaTest={0.5} toneMapped={false} side={THREE.FrontSide} />
    </mesh>
  )
}
