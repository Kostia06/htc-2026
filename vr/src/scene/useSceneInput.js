import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useXRInputSourceState } from '@react-three/xr'

// The scene's timing and input hooks: controller buttons, the keyboard, and
// the two short-lived flags (score card, sign-in greeting).

// True for `ms` after `at` last changed.
export function useRecent(at, ms) {
  const [fresh, setFresh] = useState(false)

  useEffect(() => {
    if (!at) return undefined
    setFresh(true)
    const timer = setTimeout(() => setFresh(false), ms)
    return () => clearTimeout(timer)
  }, [at, ms])

  return fresh
}

// True for `ms` after a sign-in made on this page load. Computed from the
// timestamp rather than set in an effect, so the keypad never unmounts for a
// frame between "signed in" and "say hi" and loses its success state.
export function useGreeting(signedInAt, ms) {
  const [, rerender] = useState(0)
  const active = signedInAt != null && Date.now() - signedInAt < ms

  useEffect(() => {
    if (!active) return undefined
    const timer = setTimeout(() => rerender((n) => n + 1), ms - (Date.now() - signedInAt))
    return () => clearTimeout(timer)
  }, [active, signedInAt, ms])

  return active
}

// Trigger or A advances; hold either to answer. B ends the interview. Polled
// rather than event-subscribed so a missed event can never leave the mic open.
// `triggerAdvances` is false while a panel (keypad, menu) owns the trigger.
export function useControllerInput({ phase, actions }, triggerAdvances, enabled = true) {
  const right = useXRInputSourceState('controller', 'right')
  const left = useXRInputSourceState('controller', 'left')
  const wasAdvanceDown = useRef(false)
  const wasEndDown = useRef(false)
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  useFrame(() => {
    const source = right ?? left
    const pad = source?.gamepad
    if (!pad || !enabled) return

    // A is never a ray click, so it works on every screen; the trigger only
    // counts as "advance" during the interview.
    const advance =
      (triggerAdvances && pad['xr-standard-trigger']?.state === 'pressed') || pad['a-button']?.state === 'pressed'
    const end = pad['b-button']?.state === 'pressed'

    if (end !== wasEndDown.current) {
      wasEndDown.current = end
      if (end) {
        actions.restart()
        return
      }
    }

    if (advance === wasAdvanceDown.current) return
    wasAdvanceDown.current = advance

    const current = phaseRef.current
    if (advance) {
      if (current === 'idle') actions.begin()
      else if (current === 'awaiting') actions.startAnswer()
      else if (current === 'done') actions.restart()
    } else if (current === 'listening') {
      actions.stopAnswer()
    }
  })
}

// Desktop parity, and the keyboard half of the accessibility requirement.
export function useKeyboard({ actions }, enabled = true) {
  const actionsRef = useRef(actions)
  actionsRef.current = actions

  useEffect(() => {
    if (!enabled) return undefined
    const onDown = (e) => {
      if (e.repeat) return
      const a = actionsRef.current
      if (e.code === 'Space') {
        e.preventDefault()
        a.startAnswer()
        return
      }
      if (e.code === 'Enter') {
        a.advance()
      }
      if (e.code === 'KeyQ') a.beginQuick() // no-op unless the room is idle
      if (e.code === 'KeyM') a.toggleMute()
      if (e.code === 'Escape') a.restart()
    }
    const onUp = (e) => {
      if (e.code === 'Space') {
        e.preventDefault()
        actionsRef.current.stopAnswer()
      }
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [enabled])
}
