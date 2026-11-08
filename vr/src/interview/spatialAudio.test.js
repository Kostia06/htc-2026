import { describe, expect, it, vi } from 'vitest'
import { connectToSpeakers, forgetClosed, setListenerPose, setVoicePosition, spatialOutputCount } from './spatialAudio.js'

const param = () => ({ value: 0 })
function fakeContext() {
  const panner = { positionX: param(), positionY: param(), positionZ: param(), connect: vi.fn() }
  const listener = { positionX: param(), positionY: param(), positionZ: param(), forwardX: param(), forwardY: param(), forwardZ: param(), upX: param(), upY: param(), upZ: param() }
  return { panner, ctx: { state: 'running', destination: {}, listener, createPanner: () => panner } }
}

describe('spatial audio', () => {
  it('routes through an HRTF panner placed at the voice', () => {
    const { ctx, panner } = fakeContext()
    const node = { connect: vi.fn() }
    setVoicePosition(0, 1.3, -1.7)
    connectToSpeakers(ctx, node)
    expect(node.connect).toHaveBeenCalledWith(panner)
    expect(panner.connect).toHaveBeenCalledWith(ctx.destination)
    expect(panner.panningModel).toBe('HRTF')
    expect(panner.positionZ.value).toBe(-1.7)

    setVoicePosition(0.1, 1.2, -1.6)
    expect(panner.positionX.value).toBe(0.1)

    setListenerPose({ x: 0, y: 1.35, z: 0 }, { x: 0, y: 0, z: -1 }, { x: 0, y: 1, z: 0 })
    expect(ctx.listener.positionY.value).toBe(1.35)
    expect(ctx.listener.forwardZ.value).toBe(-1)
  })

  it('falls back to a plain connection without panners', () => {
    const node = { connect: vi.fn() }
    const ctx = { destination: {} }
    connectToSpeakers(ctx, node)
    expect(node.connect).toHaveBeenCalledWith(ctx.destination)
  })

  it('forgets closed contexts', () => {
    const { ctx } = fakeContext()
    connectToSpeakers(ctx, { connect: () => {} })
    const before = spatialOutputCount()
    ctx.state = 'closed'
    forgetClosed()
    expect(spatialOutputCount()).toBe(before - 1)
  })
})
