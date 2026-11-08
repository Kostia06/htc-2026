import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useHaptics } from './haptics.js'
import { motion, travel } from './tokens.js'

/**
 * Hover / press state for anything the ray can press, plus `offset`, a spring
 * (metres along the face's normal) to move the face by: toward the ray on
 * hover, back on press. R3F pointer events cover the Quest controller ray,
 * hand pointers and a desktop mouse alike.
 */
export function usePressable({ onPress, disabled = false, reducedMotion = false }) {
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  const tap = useHaptics()
  const offset = useRef({ x: 0, v: 0 })

  useFrame((_, delta) => {
    const s = offset.current
    const target = disabled ? 0 : pressed ? travel.press : hovered ? travel.hover : 0
    if (reducedMotion) {
      s.x = target
      return
    }
    // critically damped: it settles, it does not wobble
    const dt = Math.min(delta, 1 / 30)
    s.v += ((target - s.x) * motion.press.stiffness - s.v * motion.press.damping) * dt
    s.x += s.v * dt
  })

  useEffect(() => () => {
    document.body.style.cursor = ''
  }, [])

  const handlers = {
    onPointerOver: (e) => {
      e.stopPropagation()
      setHovered(true)
      if (!disabled) document.body.style.cursor = 'pointer'
    },
    onPointerOut: () => {
      setHovered(false)
      setPressed(false)
      document.body.style.cursor = ''
    },
    onPointerDown: (e) => {
      e.stopPropagation()
      if (disabled) return
      setPressed(true)
      tap()
    },
    onPointerUp: () => setPressed(false),
    onClick: (e) => {
      e.stopPropagation()
      if (!disabled) onPress?.()
    },
  }

  return { hovered: hovered && !disabled, pressed: pressed && !disabled, offset, handlers }
}
