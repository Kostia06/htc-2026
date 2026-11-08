import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { color as palette, font as fonts, type } from './tokens.js'

// Shared materials: one per colour, so a screen full of cards is a handful of
// programs and the GPU is not switching state for every rectangle.
const materials = new Map()
export function flat(hex) {
  if (!materials.has(hex)) {
    materials.set(hex, new THREE.MeshBasicMaterial({ color: hex, toneMapped: false }))
  }
  return materials.get(hex)
}

// Panels and keys are objects in the office, so they take its light: matte,
// one roughness everywhere, no metal. Text and small marks stay `flat`.
const litMaterials = new Map()
export function lit(hex) {
  if (!litMaterials.has(hex)) {
    litMaterials.set(hex, new THREE.MeshStandardMaterial({ color: hex, roughness: 0.82, metalness: 0 }))
  }
  return litMaterials.get(hex)
}

// Weight follows the phone's text styles: headings semibold/bold, body regular.
const WEIGHT = {
  score: 'rounded',
  largeTitle: 'bold',
  title: 'bold',
  title2: 'bold',
  title3: 'semibold',
  headline: 'semibold',
}

/**
 * Text in one of the phone's styles. `variant` picks size and weight,
 * `tone` a palette colour name (or any hex).
 */
export function Label({ variant = 'body', tone = 'text', weight, children, ...props }) {
  const face = fonts[weight ?? WEIGHT[variant] ?? 'regular']
  return (
    <Text
      font={face}
      fontSize={type[variant] ?? type.body}
      color={palette[tone] ?? tone}
      lineHeight={1.28}
      renderOrder={10}
      material-toneMapped={false}
      {...props}
    >
      {children}
    </Text>
  )
}
