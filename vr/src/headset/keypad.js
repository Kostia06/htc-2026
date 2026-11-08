// The 4-digit keypad, as data. The panel in src/scene/PairingPanel.jsx only
// renders this and forwards presses, so the rules live here where they are
// trivially testable.

export const CODE_LENGTH = 4

// Rows are laid out exactly as drawn on the panel, phone style.
export const KEYPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['clear', '0', 'backspace'],
]

export const isDigit = (key) => /^[0-9]$/.test(key)

export function pressKey(code, key) {
  if (key === 'clear') return ''
  if (key === 'backspace') return code.slice(0, -1)
  if (!isDigit(key) || code.length >= CODE_LENGTH) return code
  return code + key
}

export const isComplete = (code) => code.length === CODE_LENGTH

// Desktop keyboard -> keypad key, or null for keys the keypad does not know.
export function keyFromKeyboard(event) {
  if (isDigit(event.key)) return event.key
  if (event.code?.startsWith('Numpad') && isDigit(event.code.slice(-1))) return event.code.slice(-1)
  if (event.key === 'Backspace') return 'backspace'
  if (event.key === 'Escape' || event.key === 'Delete') return 'clear'
  return null
}

export function messageFor(problem) {
  switch (problem) {
    case 'wrong':
      return 'Wrong code'
    case 'rate_limited':
      return 'Too many tries, wait a minute'
    case 'offline':
      return 'You are offline'
    default:
      return 'Could not reach Skillit, try again'
  }
}
