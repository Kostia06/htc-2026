import { Card, Outline } from './Card.jsx'
import { usePressable } from './usePressable.js'
import { color, ledge, radius as radii } from './tokens.js'

/**
 * A pressable card (RaisedSurfaceStyle.raisedCard): the face sinks into its
 * ledge on press. Selected tiles get a sage ring, the app's "selected" colour;
 * hover gets a fainter one so the ray always shows what it is on.
 */
export function RaisedTile({ width, height, radius = radii.card, selected = false, onPress, disabled, reducedMotion, children, ...props }) {
  const { hovered, pressed, handlers } = usePressable({ onPress, disabled, reducedMotion })
  const sunk = pressed && !disabled ? ledge.card : 0

  return (
    <group {...props} {...handlers}>
      <Card width={width} height={height} radius={radius} sunk={sunk} edge={selected ? null : color.hairline}>
        {(selected || hovered) && (
          <Outline
            width={width}
            height={height}
            radius={radius}
            line={selected ? 0.004 : 0.0025}
            tone={selected ? color.action : color.text3}
            z={-0.0012}
          />
        )}
        {children}
      </Card>
    </group>
  )
}
