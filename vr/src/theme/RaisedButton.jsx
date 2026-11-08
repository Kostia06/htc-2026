import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { roundedSlab } from './geometry.js'
import { Label, lit } from './Label.jsx'
import { usePressable } from './usePressable.js'
import { color, depth as depths, hoverOf, ledgeOf, radius as radii, size } from './tokens.js'

// The phone's RaisedButtonStyle as a real key: it stands 7 mm proud of the
// panel, its sides in the phone's darker ledge colour. Sage with dark text is
// the one thing to press; secondary is the quieter one beside it. Under the ray
// the key lightens and comes 2.5 mm toward you; pressed, it travels in and the
// controller ticks.
const TONES = {
  action: { face: color.action, ink: color.onAction },
  secondary: { face: color.secondaryButton, ink: color.text },
  chip: { face: color.chip, ink: color.text },
  negative: { face: color.negative, ink: color.onAction },
}

export function RaisedButton({
  label,
  onPress,
  tone = 'action',
  width = 0.3,
  height = size.buttonHeight,
  radius = radii.button,
  disabled = false,
  variant = 'headline',
  children,
  reducedMotion,
  ...props
}) {
  const { face, ink } = TONES[tone] ?? TONES.action
  const { hovered, offset, handlers } = usePressable({ onPress, disabled, reducedMotion })
  const shownFace = disabled ? color.chip : hovered ? hoverOf(face) : face
  const key = useRef()
  const materials = useMemo(() => [lit(shownFace), lit(ledgeOf(face))], [shownFace, face])

  useFrame(() => {
    if (key.current) key.current.position.z = depths.key + offset.current.x
  })

  return (
    <group {...props}>
      <group {...handlers}>
        <group ref={key} position-z={depths.key}>
          <mesh geometry={roundedSlab(width, height, radius, depths.key, depths.keyBevel)} material={materials} />
          <group position-z={0.002}>
            {children ?? (
              <Label variant={variant} tone={disabled ? color.text2 : ink} anchorX="center" anchorY="middle">
                {label}
              </Label>
            )}
          </group>
        </group>
      </group>
    </group>
  )
}
