import { afterEach, describe, expect, it, vi } from 'vitest'
import { ensureMicrophone, enterImmersive, openMicrophone, primeMicrophone, resetMicrophone } from './microphone.js'

function fakeStream() {
  const track = { readyState: 'live', stop: vi.fn(() => (track.readyState = 'ended')) }
  return { getAudioTracks: () => [track], getTracks: () => [track], clone: vi.fn(() => fakeStream()) }
}

function fakeNavigator({ permission = 'prompt', deny = false } = {}) {
  return {
    permissions: { query: vi.fn(async () => ({ state: permission })) },
    mediaDevices: {
      getUserMedia: vi.fn(async () => {
        if (deny) throw Object.assign(new Error('no'), { name: 'NotAllowedError' })
        return fakeStream()
      }),
    },
  }
}

afterEach(() => resetMicrophone())

describe('microphone before VR', () => {
  it('asks for the mic before entering the immersive session', async () => {
    const order = []
    const prime = vi.fn(async () => order.push('mic'))
    const enter = vi.fn(async () => order.push('xr'))
    expect(await enterImmersive(enter, { prime })).toBe(true)
    expect(order).toEqual(['mic', 'xr'])
  })

  it('requests one XR session however often Enter VR is pressed', async () => {
    let active = false
    const enter = vi.fn(async () => {
      active = true
    })
    const options = { prime: async () => {}, isActive: () => active }
    const [a, b] = await Promise.all([enterImmersive(enter, options), enterImmersive(enter, options)])
    expect([a, b]).toEqual([true, true])
    expect(await enterImmersive(enter, options)).toBe(true)
    expect(enter).toHaveBeenCalledTimes(1)
  })

  it('reports a failed enter instead of throwing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await enterImmersive(() => Promise.reject(new Error('no activation')), { prime: async () => {} })).toBe(false)
    warn.mockRestore()
  })

  it('never shows a prompt inside VR when the mic was not granted yet', async () => {
    const nav = fakeNavigator({ permission: 'prompt' })
    expect(await ensureMicrophone({ immersive: true, nav })).toEqual({ ok: false, reason: 'needs-2d' })
    expect(nav.mediaDevices.getUserMedia).not.toHaveBeenCalled()
  })

  it('opens the mic inside VR when the browser already granted it', async () => {
    const nav = fakeNavigator({ permission: 'granted' })
    expect(await ensureMicrophone({ immersive: true, nav })).toEqual({ ok: true })
    expect(nav.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1)
  })

  it('may prompt on the flat page, and reports a denial', async () => {
    expect(await ensureMicrophone({ immersive: false, nav: fakeNavigator() })).toEqual({ ok: true })
    resetMicrophone()
    expect(await ensureMicrophone({ nav: fakeNavigator({ deny: true }) })).toEqual({ ok: false, reason: 'denied' })
  })

  it('hands later consumers a clone of the primed stream, with no second getUserMedia', async () => {
    const nav = fakeNavigator()
    await primeMicrophone(nav)
    await primeMicrophone(nav)
    const stream = await openMicrophone(undefined, nav)
    expect(nav.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1)
    expect(stream.getAudioTracks()[0].readyState).toBe('live')
  })
})
