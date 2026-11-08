import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { color, motion } from '../theme/tokens.js'

// Fade-through-dark between keypad, menu, interview and summary.
// In a headset a hard cut of everything around you is jarring; a short dip
// to the app's ground colour is the comfortable way to change the world.
//
// One shared veil: anything can ask for darkness (`holds`), and whatever was
// waiting swaps once the veil is fully closed.

// starts closed, so the first room fades in instead of popping
const veil = { opacity: 1, holds: 0 }

/** A sphere around the camera, drawn over everything. Mount once. */
export function Veil() {
  const camera = useThree((s) => s.camera)
  const mesh = useRef()
  const material = useRef()

  useFrame((_, delta) => {
    const closing = veil.holds > 0
    const rate = delta / (closing ? motion.fadeOut : motion.fadeIn)
    veil.opacity = THREE.MathUtils.clamp(veil.opacity + (closing ? rate : -rate), 0, 1)
    if (!mesh.current) return
    mesh.current.visible = veil.opacity > 0.001
    camera.getWorldPosition(mesh.current.position)
    material.current.opacity = veil.opacity
  })

  return (
    <mesh ref={mesh} renderOrder={10000} frustumCulled={false} visible={false}>
      <sphereGeometry args={[0.3, 16, 12]} />
      <meshBasicMaterial ref={material} color={color.ground} side={THREE.BackSide} transparent depthTest={false} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

/**
 * Returns `value`, but only switches to a new one once the veil has closed,
 * so the swap happens in the dark.
 */
export function useFadeSwap(value) {
  const [shown, setShown] = useState(value)
  const latest = useRef(value)
  const holding = useRef(false)
  latest.current = value

  useEffect(() => {
    if (value !== shown && !holding.current) {
      holding.current = true
      veil.holds += 1
    }
  }, [value, shown])

  useEffect(() => () => {
    if (holding.current) veil.holds -= 1
  }, [])

  useFrame(() => {
    if (!holding.current || veil.opacity < 0.98) return
    holding.current = false
    veil.holds -= 1
    setShown(latest.current)
  })

  return shown
}
