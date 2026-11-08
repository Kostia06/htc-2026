import { useMemo } from 'react'
import * as THREE from 'three'
import { roundedOutline, roundedRect, roundedSlab, softShadowTexture } from './geometry.js'
import { flat, lit } from './Label.jsx'
import { color, depth, radius as radii } from './tokens.js'

/**
 * The app's card as an object in the room: a matte slab ~2 cm thick with
 * softened edges, one hairline border on the face, and a soft shadow on the
 * air behind it so it reads as floating in front of the office rather than
 * printed on it. Children sit just in front of the face; (0, 0) is its centre.
 */
export function Card({ width, height, radius = radii.card, face = color.raised, edge = color.hairline, edgeWidth = 0.0012, shadow = true, children, ...props }) {
  return (
    <group {...props}>
      {shadow && <DropShadow width={width} height={height} />}
      <mesh geometry={roundedSlab(width, height, radius, depth.panel, depth.panelBevel)} material={lit(face)} />
      {edge && <mesh geometry={roundedOutline(width - depth.panelBevel * 2, height - depth.panelBevel * 2, radius - depth.panelBevel, edgeWidth)} material={flat(edge)} position-z={0.0004} />}
      <group position-z={0.002}>{children}</group>
    </group>
  )
}

function DropShadow({ width, height }) {
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ map: softShadowTexture(), transparent: true, opacity: 0.4, depthWrite: false, toneMapped: false }),
    [],
  )
  // the texture's blurred rect fills the middle 62% of it
  return (
    <mesh material={material} position={[0, -0.012, -depth.panel - 0.012]} scale={[(width + 0.03) / 0.62, (height + 0.03) / 0.62, 1]} renderOrder={-1}>
      <planeGeometry />
    </mesh>
  )
}

/**
 * A rounded area on a card. Flat by default (an inset well: digit slots,
 * meter tracks); `raised` makes it a low pill standing off the face (chips).
 */
export function Surface({ width, height, radius = radii.key, face = color.inset, raised = false, z = 0.0006, ...props }) {
  if (raised) {
    return <mesh geometry={roundedSlab(width, height, radius, depth.chip, depth.chip / 3)} material={lit(face)} position-z={depth.chip} {...props} />
  }
  return <mesh geometry={roundedRect(width, height, radius)} material={flat(face)} position-z={z} {...props} />
}

/** A thin outline, e.g. the ring on the digit slot being typed into. */
export function Outline({ width, height, radius = radii.card, line = 0.003, tone = color.action, z = 0.0008, ...props }) {
  return <mesh geometry={roundedOutline(width, height, radius, line)} material={flat(tone)} position-z={z} {...props} />
}
