import { useCallback } from 'react'
import { useXR } from '@react-three/xr'

// The phone gives a light impact on every press (`.sensoryFeedback(.impact)`);
// this is the same thing through the Quest controllers.

export const TAP = { strength: 0.35, ms: 18 }

function buzz(gamepad, { strength, ms }) {
  const actuator = gamepad.hapticActuators?.[0]
  if (actuator?.pulse) return actuator.pulse(strength, ms)
  // Newer browsers moved to the Gamepad Extensions' successor.
  return gamepad.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength })
}

/**
 * Buzzes the controller(s) currently holding a button down, or every
 * controller when `everyone` is set. Returns how many it buzzed, for tests.
 * A pulse is best-effort: a failed one is never worth an error.
 */
export function pulse(session, effect = TAP, { everyone = false } = {}) {
  let count = 0
  for (const source of session?.inputSources ?? []) {
    const pad = source.gamepad
    if (!pad) continue
    if (!everyone && !pad.buttons?.some((b) => b.pressed)) continue
    try {
      const result = buzz(pad, effect)
      result?.catch?.(() => {})
      count += 1
    } catch {
      // Some runtimes throw on an actuator that is busy; skip it.
    }
  }
  return count
}

// No hover buzz: a pointer event does not say which hand's ray it came from,
// and buzzing both hands for one ray feels wrong.
/** Returns `tap()`, called on press. */
export function useHaptics() {
  const session = useXR((state) => state.session)
  return useCallback(() => pulse(session, TAP), [session])
}
