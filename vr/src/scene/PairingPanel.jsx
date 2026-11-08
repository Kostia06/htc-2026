import { useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import { Card, Label, Logo, Outline, RaisedButton, Surface, TextLink, color, space, type } from '../theme/index.js'
import { CODE_LENGTH, KEYPAD_ROWS, isComplete, keyFromKeyboard, messageFor, pressKey } from '../headset/keypad.js'

// The sign-in keypad, drawn like the phone's code screen: big rounded digits,
// the app's raised keys, sage for the slot you are typing into. Sits dead ahead
// where the menu will be once the candidate is in, so the eye line does not
// move when it swaps out.
//
// Keys are 0.12 m wide: at the 1.2 m the panel floats that is nearly six
// degrees, big enough to hit with a controller ray without aiming, and the gaps
// keep a wobbly hand from pressing two.

const KEY_W = 0.12
const KEY_H = 0.078
const KEY_GAP = 0.02
const SLOT_W = 0.085
const SLOT_H = 0.11
const SLOT_GAP = 0.022

const WIDTH = KEY_W * 3 + KEY_GAP * 2 + space.xl * 2
const HEIGHT = 0.92

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
  const message = messageOf({ status, busy, feedback })
  // A stored sign-in being refreshed is not a signed-out headset: no "Sign in"
  // ask and no keys until the refresh is refused.
  const restoring = status === 'restoring'
  const locked = busy || Boolean(feedback?.ok) || restoring

  return (
    <group position={position} rotation={rotation}>
      <group ref={body}>
        <Card width={WIDTH} height={HEIGHT}>
          <Logo size={0.07} position={[0, half - space.xl - 0.035, 0.001]} />
          <Label variant="title2" anchorX="center" anchorY="top" position={[0, half - space.xl - 0.085, 0]}>
            {feedback?.ok ? greeting : restoring ? 'Welcome back' : 'Sign in to Skillit'}
          </Label>
          <Label variant="subhead" tone="text2" anchorX="center" anchorY="top" textAlign="center" maxWidth={WIDTH - space.xl * 2} position={[0, half - space.xl - 0.13, 0]}>
            {feedback?.ok ? 'Taking you in' : restoring ? 'One moment' : 'On your phone, open Practice, then Practice in VR'}
          </Label>

          <DigitSlots code={code} error={Boolean(feedback?.problem)} ok={Boolean(feedback?.ok)} position={[0, half - 0.33, 0]} />

          <Label variant="footnote" weight="semibold" tone={message.tone} anchorX="center" anchorY="middle" position={[0, half - 0.415, 0]}>
            {message.text}
          </Label>

          <group position={[0, half - 0.485, 0.003]}>
            {KEYPAD_ROWS.map((row, r) =>
              row.map((key, c) => (
                <Key
                  key={key}
                  label={key}
                  disabled={locked}
                  reducedMotion={reducedMotion}
                  onPress={() => press(key)}
                  position={[(c - 1) * (KEY_W + KEY_GAP), -r * (KEY_H + KEY_GAP), 0]}
                />
              )),
            )}
          </group>

          {onSkip && !feedback?.ok && !restoring && (
            <TextLink label="Try with example data instead" onPress={onSkip} position={[0, -half + space.l, 0]} reducedMotion={reducedMotion} />
          )}
        </Card>
      </group>
    </group>
  )
}

function messageOf({ status, busy, feedback }) {
  if (feedback?.ok) return { text: 'Signed in', tone: 'positive' }
  if (feedback?.problem) return { text: messageFor(feedback.problem), tone: 'negative' }
  if (busy) return { text: 'Checking', tone: 'text2' }
  if (status === 'restoring') return { text: 'Signing you back in', tone: 'text2' }
  if (status === 'reconnecting') return { text: 'Reconnecting, or type a new code', tone: 'text2' }
  return { text: 'Enter the 4-digit code from your phone', tone: 'text2' }
}

function DigitSlots({ code, error, ok, position }) {
  const total = CODE_LENGTH * SLOT_W + (CODE_LENGTH - 1) * SLOT_GAP
  const ring = error ? color.negative : ok ? color.positive : color.action
  return (
    <group position={position}>
      {Array.from({ length: CODE_LENGTH }, (_, i) => {
        const x = -total / 2 + SLOT_W / 2 + i * (SLOT_W + SLOT_GAP)
        const filled = i < code.length
        const active = i === code.length && !ok
        return (
          <group key={i} position={[x, 0, 0]}>
            <Surface width={SLOT_W} height={SLOT_H} radius={0.02} face={color.inset} />
            {(active || error || ok) && <Outline width={SLOT_W} height={SLOT_H} radius={0.02} line={0.003} tone={ring} z={0.0009} />}
            <Label variant="score" tone={filled ? 'text' : 'text3'} anchorX="center" anchorY="middle" fontSize={type.largeTitle * 1.5} position={[0, 0.004, 0.001]}>
              {filled ? code[i] : active ? '_' : ''}
            </Label>
          </group>
        )
      })}
    </group>
  )
}

// Plain words: the bundled Inter subset has no backspace glyph.
const KEY_LABELS = { backspace: 'Back', clear: 'Clear' }

function Key({ label, onPress, disabled, reducedMotion, position }) {
  const isAction = label === 'backspace' || label === 'clear'
  return (
    <RaisedButton
      tone={isAction ? 'secondary' : 'chip'}
      width={KEY_W}
      height={KEY_H}
      radius={0.022}
      disabled={disabled}
      onPress={onPress}
      reducedMotion={reducedMotion}
      position={position}
    >
      <Label
        variant={isAction ? 'subhead' : 'score'}
        weight={isAction ? 'semibold' : 'rounded'}
        fontSize={isAction ? type.subhead : type.title}
        tone={disabled ? 'text3' : isAction ? 'text2' : 'text'}
        anchorX="center"
        anchorY="middle"
        position={[0, 0.002, 0]}
      >
        {KEY_LABELS[label] ?? label}
      </Label>
    </RaisedButton>
  )
}
