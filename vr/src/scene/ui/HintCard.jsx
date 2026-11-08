import { Card, Label, RaisedButton, space, type } from '../../theme/index.js'
import { HEADSET_HINTS } from '../../ui/useHints.js'

const WIDTH = 0.5
const INNER = WIDTH - space.xl * 2
const LINE = type.callout * 1.3

// Troika lays text out off-thread, so estimate each hint's wrapped lines to
// stack them without overlap.
const linesOf = (text) => Math.ceil((text.length * type.callout * 0.53) / INNER)

/** The headset's how-to card: four short lines and a Got it. */
export function HintCard({ onClose, reducedMotion, ...props }) {
  const tops = []
  let y = 0.05
  for (const hint of HEADSET_HINTS) {
    tops.push(y)
    y += linesOf(hint) * LINE + 0.022
  }
  const height = space.xl * 2 + y + 0.08
  const left = -WIDTH / 2 + space.xl
  const top = height / 2 - space.xl
  return (
    <group {...props}>
      <Card width={WIDTH} height={height}>
        <Label variant="headline" anchorX="left" anchorY="top" position={[left, top, 0]}>
          How it works
        </Label>
        {HEADSET_HINTS.map((hint, i) => (
          <Label key={hint} variant="callout" tone="text2" anchorX="left" anchorY="top" lineHeight={1.3} maxWidth={INNER} position={[left, top - tops[i], 0]}>
            {hint}
          </Label>
        ))}
        <RaisedButton
          label="Got it"
          tone="secondary"
          variant="subhead"
          width={INNER}
          height={0.056}
          onPress={onClose}
          reducedMotion={reducedMotion}
          position={[0, -height / 2 + space.xl + 0.028, 0.003]}
        />
      </Card>
    </group>
  )
}
