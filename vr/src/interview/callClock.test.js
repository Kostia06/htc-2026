import { describe, expect, it } from 'vitest'
import { createCallClock } from './callClock.js'

describe('call clock', () => {
  it('stamps an answer from when the agent stopped, in seconds since the first connect', () => {
    let t = 1000
    const clock = createCallClock(() => t)
    expect(clock.stamp()).toEqual({})
    clock.started()
    t = 7000
    clock.floorOpened()
    t = 15000
    expect(clock.stamp()).toEqual({ answerStartSec: 6, atSec: 14 })
  })

  it('keeps the first connect across a reconnect, and falls back to the send time without a hand-over', () => {
    let t = 0
    const clock = createCallClock(() => t)
    clock.started()
    t = 30000
    clock.started()
    t = 40000
    expect(clock.stamp()).toEqual({ answerStartSec: 40, atSec: 40 })
  })
})
