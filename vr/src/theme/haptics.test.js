import { describe, expect, it, vi } from 'vitest'
import { pulse } from './haptics.js'

const controller = ({ pressed = false, kind = 'pulse' } = {}) => {
  const fn = vi.fn(() => Promise.resolve(true))
  const gamepad = { buttons: [{ pressed }] }
  if (kind === 'pulse') gamepad.hapticActuators = [{ pulse: fn }]
  else gamepad.vibrationActuator = { playEffect: fn }
  return { fn, gamepad }
}

describe('pulse', () => {
  it('buzzes only the controller holding a button', () => {
    const held = controller({ pressed: true })
    const idle = controller()
    expect(pulse({ inputSources: [held, idle] })).toBe(1)
    expect(held.fn).toHaveBeenCalledWith(0.35, 18)
    expect(idle.fn).not.toHaveBeenCalled()
  })

  it('falls back to vibrationActuator', () => {
    const held = controller({ pressed: true, kind: 'vibration' })
    pulse({ inputSources: [held] })
    expect(held.fn).toHaveBeenCalledWith('dual-rumble', expect.objectContaining({ duration: 18 }))
  })

  it('does nothing without a session or a gamepad', () => {
    expect(pulse(null)).toBe(0)
    expect(pulse({ inputSources: [{}] })).toBe(0)
  })

  it('swallows an actuator that throws', () => {
    const busy = {
      gamepad: {
        buttons: [{ pressed: true }],
        hapticActuators: [{ pulse: () => { throw new Error('busy') } }],
      },
    }
    expect(() => pulse({ inputSources: [busy] })).not.toThrow()
  })
})
