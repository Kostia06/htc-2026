import { Text } from '@react-three/drei'
import { font } from './tokens.js'

// drei's Text suspends the first time each font is used. With no boundary
// nearer than the Canvas, that blanked the whole room for a second mid-
// interview: the first score card is the first text in the rounded score font.
// Loading every face once, up front (under the opening veil), means no panel
// can suspend the room later.
export function WarmFonts() {
  return Object.values(font).map((face) => (
    <Text key={face} font={face} fontSize={0.001} visible={false}>
      0
    </Text>
  ))
}
