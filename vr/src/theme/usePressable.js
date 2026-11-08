import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useHaptics } from './haptics.js'
import { motion } from './tokens.js'

/**
 * Hover / press state for anything the ray can press, plus a spring `sink`
 * (0 = resting, 1 = fully pressed into its ledge) to animate the face with.
 * R3F pointer events cover the Quest controller ray, hand pointers and a
 * desktop mouse alike.
 */
export function usePressable({ onPress, disabled = false, reducedMotion = false }) {
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  const tap = useHaptics()
  const sink = useRef({ x: 0, v: 0 })

  useFrame((_, delta) => {
    const s = sink.current
    const target = pressed && !disabled ? 1 : 0
    if (reducedMotion) {
      s.x = target
      return
    }
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

  return { hovered: hovered && !disabled, pressed, sink, handlers }
}
