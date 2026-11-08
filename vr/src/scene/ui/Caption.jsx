import { Card, Label, type } from '../../theme/index.js'

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
  if (!text) return null
  const shown = text.length > MAX_CHARS ? `…${text.slice(-MAX_CHARS)}` : text
  // troika lays out off-thread; estimate lines so the card fits the words
  const lines = Math.min(4, Math.ceil((shown.length * type.callout * 0.53) / (WIDTH - 0.06)))
  const height = 0.04 + lines * type.callout * 1.3
  return (
    <group {...props}>
      <Card width={WIDTH} height={height}>
        <Label variant="callout" tone={tone} anchorX="center" anchorY="middle" textAlign="center" lineHeight={1.3} maxWidth={WIDTH - 0.06}>
          {shown}
        </Label>
      </Card>
    </group>
  )
}
