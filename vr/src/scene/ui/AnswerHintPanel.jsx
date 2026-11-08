import { Card, Label, space, type } from '../../theme/index.js'

const WIDTH = 0.42
const INNER = WIDTH - space.l * 2
const LINE = type.callout * 1.3
const linesOf = (text) => Math.max(1, Math.ceil((text.length * type.callout * 0.53) / (INNER - 0.02)))

/** The Hints card on the desk: what to cover in this answer. Never spoken. */
export function AnswerHintPanel({ points, ...props }) {
  const tops = []
  let y = 0.04
  for (const point of points) {
    tops.push(y)
    y += linesOf(point) * LINE + 0.012
  }
  const height = space.l * 2 + y
  const left = -WIDTH / 2 + space.l
  const top = height / 2 - space.l
  return (
    <group {...props}>
      <Card width={WIDTH} height={height}>
        <Label variant="footnote" tone="text2" anchorX="left" anchorY="top" position={[left, top, 0]}>
          Hint · what to cover
        </Label>
        {points.map((point, i) => (
          <Label key={point} variant="callout" anchorX="left" anchorY="top" lineHeight={1.3} maxWidth={INNER - 0.02} position={[left + 0.02, top - tops[i], 0]}>
            {point}
          </Label>
        ))}
        {points.map((point, i) => (
          <Label key={`dot-${point}`} variant="callout" tone="text2" anchorX="left" anchorY="top" position={[left, top - tops[i], 0]}>
            •
          </Label>
        ))}
      </Card>
    </group>
  )
}
