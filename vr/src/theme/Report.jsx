import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Surface } from './Card.jsx'
import { Label, flat } from './Label.jsx'
import { color, scoreTone, type } from './tokens.js'

// The phone report's building blocks (ios/Skillit/Features/Practice/
// DebriefRows.swift), for any panel that shows results: score cards, the
// summary, a list of moments. Positions are the block's top-left corner.

/** The big rounded number counting up, "/100" beside it, the verdict under. */
export function ScoreHeadline({ score, verdict, maxWidth = 0.5, onVerdictSync, reducedMotion, ...props }) {
  const shown = useCountUp(Math.round(score ?? 0), reducedMotion)
  const digits = String(shown).length
  return (
    <group {...props}>
      <Label variant="score" anchorX="left" anchorY="top" letterSpacing={-0.01}>
        {String(shown)}
      </Label>
      <Label variant="title3" weight="semibold" tone="text2" anchorX="left" anchorY="top" position={[digits * type.score * 0.6 + 0.008, -type.score * 0.42, 0]}>
        /100
      </Label>
      {verdict && (
        <Label variant="title3" weight="semibold" anchorX="left" anchorY="top" maxWidth={maxWidth} position={[0, -type.score * 1.18, 0]} onSync={onVerdictSync}>
          {verdict}
        </Label>
      )}
    </group>
  )
}

/** A section heading, like "Work on next". */
export function SectionTitle({ children, ...props }) {
  return (
    <Label variant="headline" anchorX="left" anchorY="top" {...props}>
      {children}
    </Label>
  )
}

/**
 * One plain row: a small coloured mark and wrapped text. `mark` is a palette
 * name — positive for what worked, text2 for what to work on, agent for a tip.
 */
export function ListRow({ text, detail, mark = 'text2', width = 0.5, onSync, ...props }) {
  return (
    <group {...props}>
      <mesh position={[0.006, -type.body * 0.62, 0]} material={flat(color[mark] ?? mark)}>
        <circleGeometry args={[0.0055, 20]} />
      </mesh>
      <Label variant="body" anchorX="left" anchorY="top" maxWidth={width - 0.03} position={[0.026, 0, 0]} onSync={onSync}>
        {text}
      </Label>
      {detail && (
        <Label variant="footnote" tone="agent" anchorX="left" anchorY="top" maxWidth={width - 0.03} position={[0.026, -type.body * 1.5, 0]}>
          {detail}
        </Label>
      )}
    </group>
  )
}

/** A labelled bar out of 100, filled in the score's tone. */
export function Meter({ label, value, width = 0.24, delay = 0, reducedMotion, ...props }) {
  const fill = useRef()
  const age = useRef(0)
  const amount = useRef(reducedMotion ? 1 : 0)
  const target = Math.max(0, Math.min(1, (value ?? 0) / 100))

  useEffect(() => {
    age.current = 0
    amount.current = reducedMotion ? 1 : 0
  }, [value, reducedMotion])

  useFrame((_, delta) => {
    age.current += delta
    if (!reducedMotion && age.current > delay) amount.current += (1 - amount.current) * Math.min(1, delta * 6)
    if (!fill.current) return
    const w = Math.max(0.0001, amount.current * target * width)
    fill.current.scale.x = w / width
    fill.current.position.x = -width / 2 + w / 2
  })

  const bar = 0.009
  return (
    <group {...props}>
      <Label variant="subhead" tone="text2" anchorX="left" anchorY="bottom" position={[-width / 2, 0.01, 0]}>
        {label}
      </Label>
      <Label variant="subhead" weight="semibold" anchorX="right" anchorY="bottom" position={[width / 2, 0.01, 0]}>
        {String(Math.round(value ?? 0))}
      </Label>
      <Surface width={width} height={bar} radius={bar / 2} face={color.inset} />
      <group ref={fill} position-z={0.0004}>
        <Surface width={width} height={bar} radius={bar / 2} face={scoreTone(value ?? 0)} />
      </group>
    </group>
  )
}

// Integer steps only: each change re-lays out the text, so do not tween floats.
function useCountUp(target, reducedMotion) {
  const [shown, setShown] = useState(reducedMotion ? target : 0)
  const start = useRef(0)
  useEffect(() => {
    start.current = 0
    if (reducedMotion) setShown(target)
  }, [target, reducedMotion])
  useFrame((_, delta) => {
    if (reducedMotion || shown === target) return
    start.current = Math.min(1, start.current + delta / 1.1)
    const eased = 1 - (1 - start.current) ** 3
    const next = Math.round(target * eased)
    if (next !== shown) setShown(next)
  })
  return shown
}
