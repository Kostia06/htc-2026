import { useCallback, useState } from 'react'

// "How to use" hints: open by themselves on the first visit only. Once
// dismissed they are gone for good on that device (the headset menu can show
// them again). Remembered per mode: the headset and desktop controls differ.

export const HEADSET_HINTS = [
  'Point and pull the trigger to press',
  'Just talk, the interviewer hears you',
  'Feedback appears on your left after each answer',
  'Press B to end the interview',
]

export const DESKTOP_HINTS = ['Drag to look around', 'Click to press, or Enter to begin', 'Allow the microphone and just talk', 'Esc to leave']

function seen(key) {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

export function useHints(mode) {
  const key = `skillit.vr.hints.${mode}`
  const [open, setOpen] = useState(() => !seen(key))
  const close = useCallback(() => {
    setOpen(false)
    try {
      localStorage.setItem(key, '1')
    } catch {
      // storage blocked: hints simply show again next visit
    }
  }, [key])
  const show = useCallback(() => setOpen(true), [])
  return { open, close, show }
}
