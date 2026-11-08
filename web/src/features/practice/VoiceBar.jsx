// VoiceBar.swift: seven capsules that move with whoever is talking. Sage while you speak, sand while the
// interviewer does, a slow sand breath while it thinks, and still grey while connecting.
import { useEffect, useRef } from 'react'

const SHAPE = [0.38, 0.62, 0.86, 1, 0.86, 0.62, 0.38]
const MAX = 120

export default function VoiceBar({ state, level }) {
  const bars = useRef([])
  const smoothed = useRef(0)
  const read = useRef(level)
  useEffect(() => {
    read.current = level
  })

  useEffect(() => {
    let frame
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const tick = (now) => {
      const t = now / 1000
      // rise at once, fall gently, so the bars don't flicker between readings
      const reading = Math.min(1, (read.current() || 0) * 2.2)
      smoothed.current = Math.max(reading, smoothed.current * 0.8)
      const lvl = state === 'speaking' ? Math.max(smoothed.current, 0.55) : smoothed.current
      bars.current.forEach((bar, i) => {
        if (!bar) return
        const shape = SHAPE[i]
        let h
        if (state === 'connecting') h = 0.14
        else if (state === 'thinking') h = 0.16 + 0.1 * shape * (0.5 + 0.5 * Math.sin(t * 1.6))
        else h = Math.max(0.14, shape * lvl * (still ? 1 : 0.75 + 0.25 * Math.sin(t * 7 + i * 1.3)))
        bar.style.height = `${h * MAX}px`
      })
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [state])

  return (
    <div className={`voice-bar is-${state}`} aria-hidden>
      {SHAPE.map((_, i) => (
        <span
          key={i}
          ref={(el) => {
            bars.current[i] = el
          }}
        />
      ))}
    </div>
  )
}
