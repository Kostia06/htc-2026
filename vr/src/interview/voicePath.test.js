import { describe, expect, it } from 'vitest'
import { voicePathOf } from './voicePath.js'

// started.voice is what session.js builds: { provider, ...credentials }
const elevenlabs = (extra = {}) => ({ voice: { provider: 'elevenlabs', kind: 'elevenlabs', ...extra } })

describe('voicePathOf', () => {
  it('takes the ElevenLabs agent whenever a signed URL came back', () => {
    expect(voicePathOf(elevenlabs({ signedUrl: 'wss://x', conversationToken: 't' }))).toEqual({ kind: 'agent' })
  })

  it('refuses the computer voice when ElevenLabs was offered without a signed URL', () => {
    expect(voicePathOf(elevenlabs()).kind).toBe('error')
    expect(voicePathOf({ voice: { kind: 'elevenlabs' } }).kind).toBe('error')
  })

  it('uses the local voice only with no realtime provider', () => {
    expect(voicePathOf({ voice: null })).toEqual({ kind: 'local' })
    expect(voicePathOf({})).toEqual({ kind: 'local' })
    expect(voicePathOf({ voice: { provider: 'gemini', kind: 'gemini-live', token: 't' } })).toEqual({ kind: 'local' })
  })
})
