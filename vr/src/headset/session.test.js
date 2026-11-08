import { describe, expect, it } from 'vitest'
import {
  REFRESH_MARGIN_MS,
  STORAGE_KEY,
  afterRefresh,
  clearSession,
  initialState,
  readSession,
  refreshDelayMs,
  saveSession,
} from './session.js'
import { CODE_LENGTH, isComplete, keyFromKeyboard, messageFor, pressKey } from './keypad.js'
import { claimProblemFor } from './api.js'

const NOW = new Date('2026-11-07T10:00:00Z')
const inMinutes = (minutes) => new Date(NOW.getTime() + minutes * 60_000).toISOString()

const live = { token: 't1', expiresAt: inMinutes(60), refreshToken: 'r1', deviceId: 'd1' }
const expired = { ...live, expiresAt: inMinutes(-5) }

const fakeStorage = () => {
  const map = new Map()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  }
}

describe('initialState', () => {
  it('starts at the keypad with nothing stored', () => {
    expect(initialState(null, NOW)).toEqual({ phase: 'signedOut' })
  })

  it('is signed in while the stored token is live', () => {
    expect(initialState(live, NOW)).toEqual({ phase: 'signedIn', session: live })
  })

  it('restores an expired token when it can be refreshed, else signs out', () => {
    expect(initialState(expired, NOW).phase).toBe('restoring')
    expect(initialState({ ...expired, refreshToken: undefined }, NOW)).toEqual({ phase: 'signedOut' })
  })
})

describe('refreshDelayMs', () => {
  it('refreshes five minutes before expiry', () => {
    expect(refreshDelayMs(live, NOW)).toBe(60 * 60_000 - REFRESH_MARGIN_MS)
  })

  it('never fires sooner than ten seconds, and never without a refresh token', () => {
    expect(refreshDelayMs(expired, NOW)).toBe(10_000)
    expect(refreshDelayMs({ ...live, refreshToken: undefined }, NOW)).toBeNull()
  })
})

describe('afterRefresh', () => {
  const restoring = { phase: 'restoring', session: expired }

  it('signs in with the new credential', () => {
    const next = { ...live, token: 't2' }
    expect(afterRefresh(restoring, { kind: 'refreshed', session: next }, NOW)).toEqual({
      phase: 'signedIn',
      session: next,
    })
  })

  it('only a rejection drops to the keypad', () => {
    expect(afterRefresh(restoring, { kind: 'rejected' }, NOW)).toEqual({ phase: 'signedOut' })
    expect(afterRefresh(restoring, { kind: 'unreachable' }, NOW)).toEqual({ phase: 'reconnecting', session: expired })
  })

  it('an unreachable server while the token is still live keeps you signed in', () => {
    const state = { phase: 'signedIn', session: live }
    expect(afterRefresh(state, { kind: 'unreachable' }, NOW)).toEqual(state)
  })
})

describe('storage', () => {
  it('round-trips a session and clears it', () => {
    const storage = fakeStorage()
    saveSession(live, storage)
    expect(readSession(storage)).toEqual(live)
    expect(storage.getItem(STORAGE_KEY)).toContain('t1')
    clearSession(storage)
    expect(readSession(storage)).toBeNull()
  })

  it('ignores garbage and shapes it does not recognise', () => {
    const storage = fakeStorage()
    storage.setItem(STORAGE_KEY, '{not json')
    expect(readSession(storage)).toBeNull()
    storage.setItem(STORAGE_KEY, JSON.stringify({ token: 42 }))
    expect(readSession(storage)).toBeNull()
  })
})

describe('keypad', () => {
  it('collects exactly four digits', () => {
    let code = ''
    for (const key of ['1', 'x', '2', '3', '4', '5']) code = pressKey(code, key)
    expect(code).toBe('1234')
    expect(code).toHaveLength(CODE_LENGTH)
    expect(isComplete(code)).toBe(true)
  })

  it('backspace and clear edit the code', () => {
    expect(pressKey('123', 'backspace')).toBe('12')
    expect(pressKey('123', 'clear')).toBe('')
    expect(isComplete('12')).toBe(false)
  })

  it('maps desktop keys, including the numpad', () => {
    expect(keyFromKeyboard({ key: '7', code: 'Digit7' })).toBe('7')
    expect(keyFromKeyboard({ key: '7', code: 'Numpad7' })).toBe('7')
    expect(keyFromKeyboard({ key: 'Backspace', code: 'Backspace' })).toBe('backspace')
    expect(keyFromKeyboard({ key: 'Escape', code: 'Escape' })).toBe('clear')
    expect(keyFromKeyboard({ key: 'Enter', code: 'Enter' })).toBeNull()
  })

  it('tells the right story for each failure', () => {
    expect(claimProblemFor(404)).toBe('wrong')
    expect(claimProblemFor(400)).toBe('wrong')
    expect(claimProblemFor(429)).toBe('rate_limited')
    expect(claimProblemFor(503)).toBe('unavailable')
    expect(messageFor('wrong')).toBe('Wrong code')
    expect(messageFor('rate_limited')).toBe('Too many tries, wait a minute')
  })
})
