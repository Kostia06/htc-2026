import { RoundedBox, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import { FONT, FONT_BOLD, GOOD, INK, MUTED, Panel } from './Panels.jsx'
import { CODE_LENGTH, KEYPAD_ROWS, isComplete, keyFromKeyboard, messageFor, pressKey } from '../headset/keypad.js'

// The sign-in keypad, in the room. Sits where the question panel will be once
// the candidate is in, so the eye line does not move when it swaps out.
//
// Everything is metres. Keys are 0.11 m wide: at the ~1 m reach they sit, that
// is about six degrees — big enough to hit with a controller ray without
// aiming, and the gaps keep a wobbly hand from pressing two.

const KEY_W = 0.11
const KEY_H = 0.075
const KEY_GAP = 0.018
const SLOT_W = 0.075
const SLOT_H = 0.1
const SLOT_GAP = 0.02

const WIDTH = 0.5
const HEIGHT = 0.72

const ACCENT = '#2f6f8a'
const KEY_BG = '#1c2330'
const KEY_HOVER = '#27303f'
const BAD = '#f08f7a'

// props:
//   status   'keypad' | 'restoring' | 'reconnecting' | 'signedIn'
//   claim    (code) => Promise<null | problem>
//   greeting what to show on success ("Hi there")
//   onSkip   optional: continue without signing in (example data)
export function PairingPanel({ status, claim, greeting, onSkip, reducedMotion, position, rotation }) {
  const [code, setCode] = useState('')
  const [feedback, setFeedback] = useState(null) // { problem } | { ok: true }
  const [busy, setBusy] = useState(false)
  const shake = useRef(0)
  const body = useRef()
  const claimRef = useRef(claim)
  claimRef.current = claim
  const codeRef = useRef(code)
  codeRef.current = code

  const press = (key) => {
    if (busy || feedback?.ok) return
    setFeedback(null)
    setCode((c) => pressKey(c, key))
  }

  // Auto-submit on the fourth digit.
  useEffect(() => {
    if (!isComplete(code) || busy) return undefined
    let cancelled = false
    setBusy(true)
    claimRef.current(code).then((problem) => {
      if (cancelled) return
      setBusy(false)
      if (problem) {
        setFeedback({ problem })
        setCode('')
        shake.current = 1
      } else {
        setFeedback({ ok: true })
      }
    })
    return () => {
      cancelled = true
    }
    // Only the code: `busy` is set inside this effect and must not retrigger it.
  }, [code])

  // Desktop keyboard: digits, Backspace, Escape. Re-bound when `press` would
  // behave differently (busy / done), which is what it closes over.
  useEffect(() => {
    const onKey = (e) => {
      const key = keyFromKeyboard(e)
      if (!key) return
      e.preventDefault()
      press(key)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, feedback?.ok])

  // Wrong code: a short horizontal shake that dies out over ~0.4 s.
  useFrame((_, delta) => {
    if (!body.current) return
    if (shake.current <= 0 || reducedMotion) {
      body.current.position.x = 0
      shake.current = 0
      return
    }
    shake.current = Math.max(0, shake.current - delta * 2.5)
    body.current.position.x = Math.sin(shake.current * 28) * 0.012 * shake.current
  })

  const half = HEIGHT / 2
  const message = messageOf({ status, busy, feedback, greeting })

  return (
    <group position={position} rotation={rotation}>
      <group ref={body}>
        <Panel width={WIDTH} height={HEIGHT}>
          <Text font={FONT_BOLD} fontSize={0.04} color={INK} anchorX="center" anchorY="top"
            position={[0, half - 0.04, 0]}>
            {feedback?.ok ? greeting : 'Sign in to Skillit'}
          </Text>
          <Text font={FONT} fontSize={0.021} color={MUTED} anchorX="center" anchorY="top" maxWidth={WIDTH - 0.08}
            position={[0, half - 0.092, 0]} textAlign="center">
            {feedback?.ok ? 'Taking you in…' : 'On your phone: Practice → Practice in VR'}
          </Text>

          <DigitSlots code={code} error={Boolean(feedback?.problem)} ok={Boolean(feedback?.ok)} position={[0, half - 0.19, 0]} />

          <Text font={FONT_BOLD} fontSize={0.02} color={message.color} anchorX="center" anchorY="middle"
            position={[0, half - 0.265, 0]} letterSpacing={0.04}>
            {message.text}
          </Text>

          <group position={[0, half - 0.33, 0]}>
            {KEYPAD_ROWS.map((row, r) =>
              row.map((key, c) => (
                <Key
                  key={key}
                  label={key}
                  disabled={busy || Boolean(feedback?.ok)}
                  reducedMotion={reducedMotion}
                  onPress={() => press(key)}
                  position={[(c - 1) * (KEY_W + KEY_GAP), -r * (KEY_H + KEY_GAP), 0]}
                />
              )),
            )}
          </group>

          {onSkip && !feedback?.ok && (
            <SkipLink onClick={onSkip} position={[0, -half + 0.03, 0]} />
          )}
        </Panel>
      </group>
    </group>
  )
}

function messageOf({ status, busy, feedback, greeting }) {
  if (feedback?.ok) return { text: greeting ? 'SIGNED IN' : '', color: GOOD }
  if (feedback?.problem) return { text: messageFor(feedback.problem).toUpperCase(), color: BAD }
  if (busy) return { text: 'CHECKING…', color: MUTED }
  if (status === 'restoring') return { text: 'SIGNING YOU BACK IN…', color: MUTED }
  if (status === 'reconnecting') return { text: 'RECONNECTING… OR TYPE A NEW CODE', color: MUTED }
  return { text: 'TYPE THE 4-DIGIT CODE', color: MUTED }
}

function DigitSlots({ code, error, ok, position }) {
  const total = CODE_LENGTH * SLOT_W + (CODE_LENGTH - 1) * SLOT_GAP
  const edge = error ? BAD : ok ? GOOD : ACCENT
  return (
    <group position={position}>
      {Array.from({ length: CODE_LENGTH }, (_, i) => {
        const x = -total / 2 + SLOT_W / 2 + i * (SLOT_W + SLOT_GAP)
        const filled = i < code.length
        const active = i === code.length && !ok
        return (
          <group key={i} position={[x, 0, 0]}>
            <RoundedBox args={[SLOT_W, SLOT_H, 0.01]} radius={0.01} smoothness={3}>
              <meshStandardMaterial
                color={filled ? '#1a2231' : '#141a26'}
                emissive={active || error || ok ? edge : '#000000'}
                emissiveIntensity={active ? 0.25 : error || ok ? 0.35 : 0}
                roughness={0.5}
              />
            </RoundedBox>
            <Text font={FONT_BOLD} fontSize={0.056} color={INK} anchorX="center" anchorY="middle" position={[0, 0, 0.007]}>
              {filled ? code[i] : active ? '_' : ''}
            </Text>
          </group>
        )
      })}
    </group>
  )
}

// Plain words: the bundled Inter subset has no ⌫ glyph.
const KEY_LABELS = { backspace: 'Back', clear: 'Clear' }

// Same interaction model as ActionButton in Panels.jsx: R3F pointer events, so
// a Quest controller ray, a hand pointer and a desktop mouse all work.
function Key({ label, onPress, disabled, reducedMotion, position }) {
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  const body = useRef()
  const isAction = label === 'backspace' || label === 'clear'

  useFrame(() => {
    if (!body.current || reducedMotion) return
    const target = disabled ? 1 : pressed ? 0.94 : hovered ? 1.05 : 1
    body.current.scale.x += (target - body.current.scale.x) * 0.3
    body.current.scale.y = body.current.scale.x
  })

  return (
    <group
      ref={body}
      position={position}
      onClick={(e) => {
        e.stopPropagation()
        if (!disabled) onPress()
      }}
      onPointerDown={(e) => {
        e.stopPropagation()
        setPressed(true)
      }}
      onPointerUp={() => setPressed(false)}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => {
        setHovered(false)
        setPressed(false)
      }}
    >
      <RoundedBox args={[KEY_W, KEY_H, 0.02]} radius={0.01} smoothness={3}>
        <meshStandardMaterial
          color={hovered && !disabled ? KEY_HOVER : KEY_BG}
          emissive={ACCENT}
          emissiveIntensity={disabled ? 0 : pressed ? 0.6 : hovered ? 0.3 : 0.06}
          roughness={0.45}
        />
      </RoundedBox>
      <Text
        font={FONT_BOLD}
        fontSize={isAction ? 0.024 : 0.04}
        color={disabled ? '#5c6472' : isAction ? MUTED : INK}
        anchorX="center"
        anchorY="middle"
        position={[0, 0, 0.012]}
      >
        {KEY_LABELS[label] ?? label}
      </Text>
    </group>
  )
}

function SkipLink({ onClick, position }) {
  const [hovered, setHovered] = useState(false)
  return (
    <group position={position}>
      <mesh
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <planeGeometry args={[0.3, 0.04]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      <Text font={FONT} fontSize={0.018} color={hovered ? INK : MUTED} anchorX="center" anchorY="middle" position={[0, 0, 0.001]}>
        Try with example data instead
      </Text>
    </group>
  )
}
