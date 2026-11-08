import { Card, Label, RaisedButton, color, font } from '../theme/index.js'
import { ScoreCard } from './ui/ScoreCard.jsx'
import { SummaryCard } from './ui/SummaryCard.jsx'

// The interview's panels, drawn in the app's theme (src/theme). Kept as the
// stable import surface for anything that adds a panel: `Panel` is the app's
// card, so a new panel built on it matches the rest automatically.

export const FONT = font.regular
export const FONT_BOLD = font.semibold
export const INK = color.text
export const MUTED = color.text2
export const GOOD = color.positive

/** The app's card. (0, 0) is its centre; children sit on its face. */
export function Panel({ width, height, radius, children, ...props }) {
  return (
    <Card width={width} height={height} radius={radius} {...props}>
      {children}
    </Card>
  )
}

/**
 * One answer's score, or the end-of-interview summary. `sample` marks numbers
 * from example data: the hackathon rules require made-up numbers to say so, in
 * the headset as well as on the desktop.
 */
export function ReviewPanel({ result, summary, meta, sample = false, onPracticeAgain, position, rotation, reducedMotion }) {
  if (!result && !summary) return null
  return (
    <group position={position} rotation={rotation}>
      {result ? (
        <ScoreCard result={result} sample={sample} reducedMotion={reducedMotion} />
      ) : (
        <SummaryCard summary={summary} meta={meta} sample={sample} onPracticeAgain={onPracticeAgain} reducedMotion={reducedMotion} />
      )}
    </group>
  )
}

// The one thing the candidate presses during the interview, lying on the desk
// within reach: a real key. Sage to start an answer, the quieter secondary to
// say you are done. A ray, a hand pointer and a mouse all press it.
export function ActionButton({ label, hint, onClick, disabled, position, rotation, tone, reducedMotion }) {
  return (
    <group position={position} rotation={rotation}>
      <RaisedButton label={label} tone={tone === 'red' ? 'secondary' : 'action'} width={0.3} disabled={disabled} onPress={onClick} reducedMotion={reducedMotion} />
      {hint && (
        <Label variant="footnote" anchorX="center" anchorY="top" position={[0, -0.06, 0]} outlineWidth={0.0015} outlineColor={color.ground} outlineOpacity={0.6}>
          {hint}
        </Label>
      )}
    </group>
  )
}
