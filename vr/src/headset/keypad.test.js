import { describe, expect, it } from 'vitest'
import { isComplete, keyFromKeyboard, messageFor, pressKey } from './keypad.js'

describe('pressKey', () => {
  it('types up to four digits and ignores the fifth', () => {
    const code = ['1', '2', '3', '4', '5'].reduce(pressKey, '')
    expect(code).toBe('1234')
    expect(isComplete(code)).toBe(true)
  })

  it('backspace removes one digit and clear empties the code', () => {
    expect(pressKey('123', 'backspace')).toBe('12')
    expect(pressKey('123', 'clear')).toBe('')
  })
})

describe('keyFromKeyboard', () => {
  it('reads digits, the numpad, Backspace and Escape', () => {
    expect(keyFromKeyboard({ key: '7' })).toBe('7')
    expect(keyFromKeyboard({ key: 'End', code: 'Numpad1' })).toBe('1')
    expect(keyFromKeyboard({ key: 'Backspace' })).toBe('backspace')
    expect(keyFromKeyboard({ key: 'Escape' })).toBe('clear')
    expect(keyFromKeyboard({ key: 'Enter' })).toBeNull()
  })
})

describe('messageFor', () => {
  it('names Skillit when the server cannot be reached', () => {
    expect(messageFor('unavailable')).toBe('Could not reach Skillit, try again')
    expect(messageFor('wrong')).toBe('Wrong code')
  })
})
