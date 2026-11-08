import { Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

// Glass panes floating in the room: a smoky see-through body, a thin bright edge
// and plain white type, so the room stays visible through every card. Unlit
// (meshBasicMaterial, no tone mapping) so they look the same whatever the light.
//
// Sizes are metres. At the ~1.1 m reading distance in this scene, body text below
// about 0.02 m stops being legible through the Quest's lenses.

export const FONT = '/fonts/Inter-Regular.woff'
export const FONT_BOLD = '/fonts/Inter-SemiBold.woff'

const C = {
  tint: '#14171c', // the smoke in the glass
  sheen: '#ffffff', // the frost on top of it
  edge: '#ffffff',
  label: '#ffffff',
  secondary: '#ffffff', // drawn at reduced opacity, see SECONDARY
  track: '#ffffff',
  blue: '#0a84ff',
  green: '#30d158',
  orange: '#ff9f0a',
  red: '#ff453a',
  grey: '#ffffff',
}
const SECONDARY = 0.62

// The sign-in keypad (PairingPanel.jsx) is drawn in these.
export const INK = '#f4f6fa'
export const MUTED = '#9aa6b8'
export const GOOD = C.green

// Matches the Worker's interview scoring keys.
const DIMENSIONS = ['structure', 'relevance', 'specificity', 'confidence']

// ---------------------------------------------------------------- primitives

function roundedPath(path, width, height, radius) {
  const w = width / 2
  const h = height / 2
  const r = Math.min(radius, w, h)
  path.moveTo(-w + r, -h)
  path.lineTo(w - r, -h)
  path.quadraticCurveTo(w, -h, w, -h + r)
  path.lineTo(w, h - r)
  path.quadraticCurveTo(w, h, w - r, h)
  path.lineTo(-w + r, h)
  path.quadraticCurveTo(-w, h, -w, h - r)
  path.lineTo(-w, -h + r)
  path.quadraticCurveTo(-w, -h, -w + r, -h)
  return path
}

const roundedRect = (width, height, radius) => new THREE.ShapeGeometry(roundedPath(new THREE.Shape(), width, height, radius), 12)

// a rounded outline `line` wide, drawn just inside the edge
function roundedOutline(width, height, radius, line) {
  const outer = roundedPath(new THREE.Shape(), width, height, radius)
  outer.holes.push(roundedPath(new THREE.Path(), width - line * 2, height - line * 2, Math.max(0, radius - line)))
  return new THREE.ShapeGeometry(outer, 12)
}

// everything here is see-through, so nothing writes depth and renderOrder layers it
function Shape({ width, height, radius, color, opacity = 1, z = 0, outline = 0, order = 1, ...props }) {
  const geometry = useMemo(
    () => (outline ? roundedOutline(width, height, radius, outline) : roundedRect(width, height, radius)),
    [width, height, radius, outline],
  )
  return (
    <mesh geometry={geometry} position-z={z} renderOrder={order} {...props}>
      <meshBasicMaterial color={color} transparent opacity={opacity} toneMapped={false} depthWrite={false} />
    </mesh>
  )
}

function Label({ children, size = 0.02, color = C.label, opacity = 1, bold = false, ...props }) {
  return (
    <Text font={bold ? FONT_BOLD : FONT} fontSize={size} color={color} fillOpacity={opacity} renderOrder={10} material-toneMapped={false} {...props}>
      {children}
    </Text>
  )
}

/**
 * A pane of smoked glass: a dark tint so white type reads against a bright room,
 * a faint frost over it, a brighter band along the top where light would catch,
 * and a thin bright edge. Children sit just in front.
 */
function Glass({ width, height, radius, smoke = 0.34, frost = 0.07, edge = 0.32 }) {
  return (
    <>
      <Shape width={width} height={height} radius={radius} color={C.tint} opacity={smoke} order={1} />
      <Shape width={width} height={height} radius={radius} color={C.sheen} opacity={frost} order={2} z={0.0003} />
      <Shape width={width - radius * 0.6} height={height * 0.3} radius={Math.min(radius * 0.8, height * 0.15)} color={C.sheen} opacity={0.035} order={3} z={0.0005} position-y={height * 0.33} />
      <Shape width={width} height={height} radius={radius} color={C.edge} opacity={edge} outline={0.0016} order={4} z={0.0007} />
    </>
  )
}

export function Panel({ width, height, radius = 0.036, children, ...props }) {
  return (
    <group {...props}>
      <Glass width={width} height={height} radius={radius} />
      <group position={[0, 0, 0.002]}>{children}</group>
    </group>
  )
}

// A value that eases toward `target` with a little overshoot, like an iOS spring.
function useSpring(target, { stiffness = 220, damping = 18, immediate = false } = {}) {
  const state = useRef({ x: target, v: 0 })
  useFrame((_, delta) => {
    const s = state.current
    if (immediate) {
      s.x = target
      s.v = 0
      return
    }
    const dt = Math.min(delta, 1 / 30)
    s.v += ((target - s.x) * stiffness - s.v * damping) * dt
    s.x += s.v * dt
  })
  return state
}

// ---------------------------------------------------------------- live indicators

/** Four little bars bouncing, like the audio indicator on iOS. */
function SoundBars({ color, position, reducedMotion }) {
  const bars = useRef([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    bars.current.forEach((bar, i) => {
      if (!bar) return
      const h = reducedMotion ? 0.6 : 0.35 + 0.65 * Math.abs(Math.sin(t * (5.2 + i * 1.3) + i * 1.7))
      bar.scale.y = h
    })
  })
  return (
    <group position={position}>
      {[0, 1, 2, 3].map((i) => (
        <group key={i} ref={(el) => (bars.current[i] = el)} position={[i * 0.006 - 0.009, 0, 0]}>
          <Shape width={0.0034} height={0.016} radius={0.0017} color={color} />
        </group>
      ))}
    </group>
  )
}

/** A dot that breathes, for "recording". */
function PulseDot({ color, position, reducedMotion }) {
  const halo = useRef()
  useFrame(({ clock }) => {
    if (!halo.current) return
    const p = reducedMotion ? 0.5 : (clock.elapsedTime * 1.2) % 1
    halo.current.scale.setScalar(1 + p * 1.4)
    halo.current.material.opacity = 0.45 * (1 - p)
  })
  return (
    <group position={position}>
      <mesh ref={halo}>
        <circleGeometry args={[0.0055, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh position-z={0.0005}>
        <circleGeometry args={[0.0055, 24]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** Three dots taking turns, for "working on it". */
function ActivityDots({ color = C.label, position, reducedMotion }) {
  const dots = useRef([])
  useFrame(({ clock }) => {
    dots.current.forEach((dot, i) => {
      if (!dot) return
      const phase = reducedMotion ? 0.5 : (Math.sin(clock.elapsedTime * 5 - i * 0.9) + 1) / 2
      dot.scale.setScalar(0.7 + phase * 0.4)
      dot.material.opacity = 0.3 + phase * 0.6
    })
  })
  return (
    <group position={position}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(el) => (dots.current[i] = el)} position={[(i - 1) * 0.011, 0, 0]}>
          <circleGeometry args={[0.0032, 16]} />
          <meshBasicMaterial color={color} transparent toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

const STATUS = {
  asking: { text: 'Interviewer is speaking', color: C.blue, live: 'bars' },
  awaiting: { text: 'Your turn', color: C.green, live: 'dot-still' },
  listening: { text: 'Listening', color: C.red, live: 'pulse' },
  scoring: { text: 'Scoring your answer', color: C.label, live: 'dots' },
  review: { text: 'Feedback is in', color: C.green, live: 'dot-still' },
  done: { text: 'Interview complete', color: C.green, live: 'dot-still' },
}

function StatusPill({ phase, position, reducedMotion }) {
  const status = STATUS[phase]
  if (!status) return null
  const iconX = 0.006
  return (
    <group position={position}>
      {status.live === 'bars' && <SoundBars color={status.color} position={[iconX, 0, 0.001]} reducedMotion={reducedMotion} />}
      {status.live === 'pulse' && <PulseDot color={status.color} position={[iconX, 0, 0.001]} reducedMotion={reducedMotion} />}
      {status.live === 'dots' && <ActivityDots position={[iconX + 0.004, 0, 0.001]} reducedMotion={reducedMotion} />}
      {status.live === 'dot-still' && (
        <mesh position={[iconX, 0, 0.001]}>
          <circleGeometry args={[0.0055, 24]} />
          <meshBasicMaterial color={status.color} toneMapped={false} />
        </mesh>
      )}
      <Label size={0.017} opacity={0.85} anchorX="left" anchorY="middle" position={[iconX + (status.live === 'dots' ? 0.02 : 0.014), 0.001, 0.001]}>
        {status.text}
      </Label>
    </group>
  )
}

function Tag({ text, position }) {
  return (
    <Label size={0.015} opacity={0.5} anchorX="right" anchorY="middle" position={position}>
      {text}
    </Label>
  )
}

// A card that pops a little whenever its content changes, so a new question feels
// like it arrived instead of the text just swapping.
function usePop(key, reducedMotion) {
  const group = useRef()
  const scale = useRef({ x: 1, v: 0 })
  useEffect(() => {
    if (!reducedMotion) scale.current.x = 0.94
  }, [key, reducedMotion])
  useFrame((_, delta) => {
    const s = scale.current
    const dt = Math.min(delta, 1 / 30)
    s.v += ((1 - s.x) * 260 - s.v * 16) * dt
    s.x += s.v * dt
    if (group.current) group.current.scale.setScalar(s.x)
  })
  return group
}

// ---------------------------------------------------------------- question card

export function QuestionPanel({ phase, question, meta, transcript, error, position, rotation, reducedMotion }) {
  const width = 0.62
  const height = 0.4
  const left = -width / 2 + 0.04
  const top = height / 2 - 0.04
  const pop = usePop(question?.id ?? phase, reducedMotion)

  const context = meta ? `${meta.company} · ${meta.role}` : 'Practice interview'
  const idle = !question && !error

  return (
    <group position={position} rotation={rotation}>
      <group ref={pop}>
        <Panel width={width} height={height}>
          <Label size={0.0175} opacity={SECONDARY} anchorX="left" anchorY="top" position={[left, top, 0]} maxWidth={width - 0.08}>
            {context}
          </Label>

          {idle ? (
            <>
              <Label size={0.04} anchorX="left" anchorY="top" position={[left, top - 0.04, 0]} maxWidth={width - 0.08} lineHeight={1.15}>
                Ready when you are
              </Label>
              <Label size={0.021} opacity={SECONDARY} anchorX="left" anchorY="top" position={[left, top - 0.1, 0]} maxWidth={width - 0.08} lineHeight={1.35}>
                Tap Begin and the interviewer will ask the first question.
              </Label>
            </>
          ) : (
            <Label size={0.031} color={error ? C.red : C.label} anchorX="left" anchorY="top" position={[left, top - 0.04, 0]} maxWidth={width - 0.08} lineHeight={1.3}>
              {error ?? question?.text}
            </Label>
          )}

          {phase === 'listening' && transcript && (
            <Label size={0.02} opacity={SECONDARY} anchorX="left" anchorY="bottom" position={[left, -height / 2 + 0.075, 0]} maxWidth={width - 0.08} lineHeight={1.3}>
              {transcript.length > 160 ? `…${transcript.slice(-160)}` : transcript}
            </Label>
          )}

          <StatusPill phase={phase} position={[left, -height / 2 + 0.04, 0]} reducedMotion={reducedMotion} />
          {question?.isSeeded && <Tag text="Example question" position={[width / 2 - 0.04, -height / 2 + 0.04, 0]} />}
        </Panel>
      </group>
    </group>
  )
}

// ---------------------------------------------------------------- score card

/** An activity-style ring that fills to `value` out of 100. */
function ScoreRing({ value, position, reducedMotion }) {
  const radius = 0.06
  const thickness = 0.013
  const color = scoreColor(value)
  const spring = useSpring(value / 100, { stiffness: 60, damping: 11, immediate: reducedMotion })
  const arc = useRef()
  const cap = useRef()
  const shown = useRef(-1)

  // start empty, then fill
  useEffect(() => {
    if (!reducedMotion) {
      spring.current.x = 0
      spring.current.v = 0
    }
  }, [value, reducedMotion, spring])

  useFrame(() => {
    const amount = THREE.MathUtils.clamp(spring.current.x, 0.001, 1)
    if (!arc.current || Math.abs(amount - shown.current) < 0.002) return
    shown.current = amount
    const length = amount * Math.PI * 2
    arc.current.geometry.dispose()
    arc.current.geometry = new THREE.RingGeometry(radius - thickness / 2, radius + thickness / 2, 64, 1, Math.PI / 2 - length, length)
    // a round end on the leading edge
    const angle = Math.PI / 2 - length
    cap.current.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.0006)
  })

  return (
    <group position={position}>
      <mesh>
        <ringGeometry args={[radius - thickness / 2, radius + thickness / 2, 64]} />
        <meshBasicMaterial color={C.track} transparent opacity={0.16} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh ref={arc} position-z={0.0005}>
        <ringGeometry args={[radius - thickness / 2, radius + thickness / 2, 8, 1, 0, 0.01]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={[0, radius, 0.0006]}>
        <circleGeometry args={[thickness / 2, 16]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh ref={cap}>
        <circleGeometry args={[thickness / 2, 16]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <Label size={0.036} anchorX="center" anchorY="middle" position={[0, 0.006, 0.001]}>
        {String(Math.round(value))}
      </Label>
      <Label size={0.014} opacity={SECONDARY} anchorX="center" anchorY="middle" position={[0, -0.024, 0.001]}>
        out of 100
      </Label>
    </group>
  )
}

function Meter({ label, value, delay, position, reducedMotion }) {
  const width = 0.2
  const fill = useRef()
  const spring = useSpring(0, { immediate: reducedMotion })
  const started = useRef(0)
  const color = scoreColor(value)

  useEffect(() => {
    started.current = 0
    if (!reducedMotion) spring.current.x = 0
  }, [value, reducedMotion, spring])

  useFrame((_, delta) => {
    started.current += delta
    const target = started.current > delay || reducedMotion ? Math.max(0, Math.min(1, value / 100)) : 0
    const s = spring.current
    if (reducedMotion) s.x = target
    else {
      const dt = Math.min(delta, 1 / 30)
      s.v += ((target - s.x) * 140 - s.v * 14) * dt
      s.x += s.v * dt
    }
    if (fill.current) {
      const w = Math.max(0.0001, s.x * width)
      fill.current.scale.x = w / width
      fill.current.position.x = -width / 2 + w / 2
    }
  })

  return (
    <group position={position}>
      <Label size={0.0155} opacity={SECONDARY} anchorX="left" anchorY="bottom" position={[-width / 2, 0.008, 0]}>
        {label.charAt(0).toUpperCase() + label.slice(1)}
      </Label>
      <Label size={0.0155} anchorX="right" anchorY="bottom" position={[width / 2, 0.008, 0]}>
        {String(Math.round(value))}
      </Label>
      <Shape width={width} height={0.007} radius={0.0035} color={C.track} opacity={0.16} />
      <group ref={fill} position-z={0.0005}>
        <Shape width={width} height={0.007} radius={0.0035} color={color} order={2} />
      </group>
    </group>
  )
}

// Renders an AnswerScore (four dimensions out of 100, pace, filler words, coaching) or
// the end-of-interview aggregate.
// `sample` marks scores that come from example data rather than the person's answer.
// The hackathon rules require made-up numbers to say so; this is where they appear,
// in the headset as well as on the desktop.
export function ReviewPanel({ result, summary, sample = false, position, rotation, reducedMotion }) {
  const width = 0.6
  const height = 0.54
  const pop = usePop(result ? `r${result.structure}${result.tip}` : 'summary', reducedMotion)
  if (!result && !summary) return null

  const overall = result ? mean(DIMENSIONS.map((d) => result[d] ?? 0)) : (summary?.overall ?? 0)
  const left = -width / 2 + 0.04
  const top = height / 2 - 0.04

  return (
    <group position={position} rotation={rotation}>
      <group ref={pop}>
        <Panel width={width} height={height}>
          <Label size={0.0175} opacity={SECONDARY} anchorX="left" anchorY="top" position={[left, top, 0]}>
            {summary ? 'How it went' : 'This answer'}
          </Label>
          {sample && <Tag text="Sample scores" position={[width / 2 - 0.04, top - 0.008, 0]} />}

          <ScoreRing value={overall} position={[left + 0.07, top - 0.11, 0]} reducedMotion={reducedMotion} />

          {result && (
            <group position={[left + 0.29, top - 0.05, 0]}>
              {DIMENSIONS.map((dim, i) => (
                <Meter key={dim} label={dim} value={result[dim] ?? 0} delay={0.15 + i * 0.08} position={[0, -i * 0.04, 0]} reducedMotion={reducedMotion} />
              ))}
            </group>
          )}

          {result && (
            <Label size={0.0155} opacity={SECONDARY} anchorX="left" anchorY="top" position={[left, top - 0.2, 0]}>
              {`${result.wpm ?? 0} words a minute · ${result.fillerWords ?? 0} filler words`}
            </Label>
          )}

          <Label size={0.021} anchorX="left" anchorY="top" position={[left, top - (result ? 0.235 : 0.21), 0]} maxWidth={width - 0.08} lineHeight={1.35}>
            {result?.tip ?? summary?.summary ?? ''}
          </Label>

          {result?.strongerAnswer && (
            <group position={[0, -height / 2 + 0.085, 0]}>
              <Shape width={width - 0.05} height={0.13} radius={0.022} color={C.sheen} opacity={0.06} order={5} />
              <Label size={0.0155} color={C.green} anchorX="left" anchorY="top" position={[left + 0.005, 0.05, 0.001]}>
                A stronger answer
              </Label>
              <Label size={0.0175} color={C.label} anchorX="left" anchorY="top" position={[left + 0.005, 0.027, 0.001]} maxWidth={width - 0.09} lineHeight={1.32}>
                {result.strongerAnswer}
              </Label>
            </group>
          )}
        </Panel>
      </group>
    </group>
  )
}

// ---------------------------------------------------------------- captions

// Captions sit under the interviewer rather than on a panel, so the candidate can
// read without looking away from the face they are supposed to hold eye contact with.
export function Captions({ text, speaker = 'Interviewer', position, rotation }) {
  if (!text) return null
  const width = 0.96
  return (
    <group position={position} rotation={rotation}>
      <Panel width={width} height={0.14} radius={0.03} position-z={-0.004} />
      <Label size={0.016} opacity={SECONDARY} anchorX="left" anchorY="top" position={[-width / 2 + 0.03, 0.05, 0]}>
        {speaker}
      </Label>
      <Label size={0.026} anchorX="left" anchorY="top" position={[-width / 2 + 0.03, 0.026, 0]} maxWidth={width - 0.06} lineHeight={1.3}>
        {text}
      </Label>
    </group>
  )
}

// ---------------------------------------------------------------- the button

// The one thing the candidate presses: an iOS capsule that swells when you point
// at it, squishes when you press, springs back and sends out a ripple. Works with
// a Quest controller ray, a hand pointer and a desktop mouse, because R3F pointer
// events cover all three.
export function ActionButton({ label, hint, onClick, disabled, busy, position, rotation, tone = 'blue', reducedMotion }) {
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  const body = useRef()
  const ripple = useRef()
  const rippleAge = useRef(Infinity)
  const scale = useSpring(disabled ? 1 : pressed ? 0.9 : hovered ? 1.06 : 1, { stiffness: 420, damping: 16, immediate: reducedMotion })
  const width = 0.28
  const height = 0.08
  // plain glass like the panels; frost thickens under the pointer
  const frost = disabled ? 0.03 : pressed ? 0.2 : hovered ? 0.13 : 0.06

  useFrame((_, delta) => {
    if (body.current) body.current.scale.setScalar(scale.current.x)
    rippleAge.current += delta
    if (ripple.current) {
      const p = Math.min(1, rippleAge.current / 0.45)
      ripple.current.visible = p < 1
      ripple.current.scale.set(1 + p * 0.35, 1 + p * 0.9, 1)
      ripple.current.children[0].material.opacity = 0.45 * (1 - p)
    }
  })

  useEffect(() => () => {
    document.body.style.cursor = ''
  }, [])

  const press = (e) => {
    e.stopPropagation()
    if (disabled) return
    if (!reducedMotion) rippleAge.current = 0
    onClick?.()
  }

  return (
    <group position={position} rotation={rotation}>
      <group
        ref={body}
        onClick={press}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerOver={() => {
          setHovered(true)
          if (!disabled) document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          setPressed(false)
          document.body.style.cursor = ''
        }}
      >
        <group ref={ripple} visible={false} position-z={-0.002}>
          <Shape width={width} height={height} radius={height / 2} color={C.sheen} opacity={0.4} order={0} />
        </group>
        {/* the panels' glass, with far less smoke: it lies over the dark table,
            where the panels' amount would read as a solid block */}
        <Glass width={width} height={height} radius={height / 2} smoke={0.08} frost={frost} edge={hovered && !disabled ? 0.65 : 0.4} />
        {busy ? (
          <ActivityDots position={[0, 0, 0.002]} reducedMotion={reducedMotion} />
        ) : (
          <>
            {/* the one bit of colour: a recording dot while the candidate is answering */}
            {tone === 'red' && <PulseDot color={C.red} position={[-0.012 - label.length * 0.0085, 0.001, 0.002]} reducedMotion={reducedMotion} />}
            <Label size={0.028} opacity={disabled ? 0.45 : 1} anchorX="center" anchorY="middle" position={[tone === 'red' ? 0.008 : 0, 0.002, 0.002]}>
              {label}
            </Label>
          </>
        )}
      </group>
      {hint && (
        <Label size={0.016} opacity={0.75} anchorX="center" anchorY="top" position={[0, -height / 2 - 0.018, 0]} outlineWidth={0.001} outlineColor="#000000" outlineOpacity={0.35}>
          {hint}
        </Label>
      )}
    </group>
  )
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

function scoreColor(value) {
  if (value >= 75) return C.green
  if (value >= 50) return C.orange
  return C.red
}
