import { Card, ExampleBadge, Label, ListRow, Meter, ScoreHeadline, Surface, color, space } from '../../theme/index.js'

// Matches the Worker's interview scoring keys.
const DIMENSIONS = ['structure', 'relevance', 'specificity', 'confidence']
const title = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

const WIDTH = 0.64
const PAD = space.l
const INNER = WIDTH - PAD * 2
const SCORE_COLUMN = 0.25 // the big number and "/100"
const METER_ROW = 0.062
const TIP_H = 0.17
const HEIGHT = PAD * 2 + 0.34 + TIP_H + 0.02

/** One answer's feedback, laid out like a card in the phone's report. */
export function ScoreCard({ result, sample, reducedMotion, ...props }) {
  const left = -WIDTH / 2 + PAD
  const top = HEIGHT / 2 - PAD
  const overall = mean(DIMENSIONS.map((d) => result[d] ?? 0))
  const meterW = INNER - SCORE_COLUMN

  return (
    <group {...props}>
      <Card width={WIDTH} height={HEIGHT}>
        <Label variant="subhead" weight="semibold" tone="text2" anchorX="left" anchorY="top" position={[left, top, 0]}>
          This answer
        </Label>
        {sample && <ExampleBadge position={[WIDTH / 2 - PAD - 0.07, top - 0.012, 0]} />}

        <ScoreHeadline score={overall} position={[left, top - 0.06, 0]} reducedMotion={reducedMotion} />

        <group position={[left + SCORE_COLUMN + meterW / 2, top - 0.095, 0]}>
          {DIMENSIONS.map((dim, i) => (
            <Meter key={dim} label={title(dim)} value={result[dim]} width={meterW} delay={0.15 + i * 0.08} position={[0, -i * METER_ROW, 0]} reducedMotion={reducedMotion} />
          ))}
        </group>

        <Label variant="footnote" tone="text2" anchorX="left" anchorY="top" position={[left, top - 0.3, 0]}>
          {`${result.wpm ?? 0} words a minute · ${result.fillerWords ?? 0} filler words`}
        </Label>

        {result.tip && (
          <group position={[0, -HEIGHT / 2 + PAD + TIP_H / 2, 0]}>
            <Surface width={INNER} height={TIP_H} radius={0.024} face={color.inset} />
            <Label variant="caption" weight="semibold" tone="agent" anchorX="left" anchorY="top" position={[left + 0.02, TIP_H / 2 - 0.02, 0.001]}>
              Coach tip
            </Label>
            <ListRow text={result.tip} mark="agent" width={INNER - 0.04} position={[left + 0.02, TIP_H / 2 - 0.05, 0.001]} />
          </group>
        )}
      </Card>
    </group>
  )
}
