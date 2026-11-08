import { Card, Label, RaisedButton, space, type } from '../../theme/index.js'
import { guessHeight, stack } from '../../theme/layout.js'
import { useTextHeights } from '../../theme/useTextHeights.js'
import { HEADSET_HINTS } from '../../ui/useHints.js'

const WIDTH = 0.56
const INNER = WIDTH - space.xl * 2
const TITLE_H = 0.05

/** The headset's how-to card: four short lines and a Got it, stacked by their measured heights. */
export function HintCard({ onClose, reducedMotion, ...props }) {
  const { measure, heightOf } = useTextHeights()
  const { tops: stacked, total } = stack(
    HEADSET_HINTS.map((hint, i) => heightOf(i, guessHeight(hint, type.callout, INNER, 1.3))),
    0.022,
  )
  const tops = stacked.map((t) => TITLE_H + t)
  const y = TITLE_H + total + 0.022
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
          <Label key={hint} variant="callout" tone="text2" anchorX="left" anchorY="top" lineHeight={1.3} maxWidth={INNER} position={[left, top - tops[i], 0]} onSync={measure(i)}>
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
