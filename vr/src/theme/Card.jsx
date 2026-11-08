import { roundedOutline, roundedRect, roundedSlab } from './geometry.js'
import { flat } from './Label.jsx'
import { color, ledge as ledgeDepth, ledgeOf, radius as radii, size } from './tokens.js'

/**
 * The app's card, as an object: an opaque slab in the card colour with a
 * hairline edge, sitting on a ledge a few millimetres lower — the same darker
 * (here, lighter) side the phone's raised tiles have. Children sit just in front
 * of the face; (0, 0) is its centre.
 */
export function Card({
  width,
  height,
  radius = radii.card,
  face = color.raised,
  edge = color.hairline,
  edgeWidth = 0.0012,
  ledge = ledgeDepth.card,
  sunk = 0,
  children,
  ...props
}) {
  return (
    <group {...props}>
      <mesh geometry={roundedSlab(width, height, radius, size.thickness)} material={flat(ledgeOf(face))} position={[0, -ledge, -0.002]} />
      <group position-y={-sunk}>
        <mesh geometry={roundedSlab(width, height, radius, size.thickness)} material={flat(face)} />
        {edge && <mesh geometry={roundedOutline(width, height, radius, edgeWidth)} material={flat(edge)} position-z={0.0004} />}
        <group position-z={0.002}>{children}</group>
      </group>
    </group>
  )
}

/** A rounded face with no ledge, for things drawn on a card (insets, chips). */
export function Surface({ width, height, radius = radii.key, face = color.inset, z = 0.0006, ...props }) {
  return <mesh geometry={roundedRect(width, height, radius)} material={flat(face)} position-z={z} {...props} />
}

/** A thin outline, e.g. the selection ring on a chosen tile. */
export function Outline({ width, height, radius = radii.card, line = 0.003, tone = color.action, z = 0.0008, ...props }) {
  return <mesh geometry={roundedOutline(width, height, radius, line)} material={flat(tone)} position-z={z} {...props} />
}
