import { Label } from './Label.jsx'
import { usePressable } from './usePressable.js'

/** A plain sage text button, for the quiet way out ("Try with example data"). */
export function TextLink({ label, onPress, width = 0.34, height = 0.05, reducedMotion, ...props }) {
  const { hovered, handlers } = usePressable({ onPress, reducedMotion })
  return (
    <group {...props} {...handlers}>
      {/* an invisible plate so the whole line is a comfortable ray target */}
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Label variant="subhead" weight="semibold" tone={hovered ? 'text' : 'action'} anchorX="center" anchorY="middle" position={[0, 0, 0.001]}>
        {label}
      </Label>
    </group>
  )
}
