import { Card, Label, type } from '../../theme/index.js'
import { guessHeight } from '../../theme/layout.js'
import { useTextHeights } from '../../theme/useTextHeights.js'

// narrow enough to stay clear of the score card on the left
const WIDTH = 0.5
const MAX_CHARS = 170

/**
 * Live captions under the interviewer, in the headset only (the desktop has
 * its own below the canvas). Captions are part of done (CONTRIBUTING.md), so
 * this is the one piece of text that stays during the interview: plain words,
 * no speaker label, no status. Nothing renders while nobody is speaking.
 */
export function Caption({ text, tone = 'text', ...props }) {
  const { measure, heightOf } = useTextHeights()
  if (!text) return null
  const shown = text.length > MAX_CHARS ? `…${text.slice(-MAX_CHARS)}` : text
  // sized from troika's measured layout, a guess only until the first one lands
  const height = 0.04 + heightOf('line', guessHeight(shown, type.callout, WIDTH - 0.06, 1.3))
  return (
    <group {...props}>
      <Card width={WIDTH} height={height}>
        <Label variant="callout" tone={tone} anchorX="center" anchorY="middle" textAlign="center" lineHeight={1.3} maxWidth={WIDTH - 0.06} onSync={measure('line')}>
          {shown}
        </Label>
      </Card>
    </group>
  )
}
