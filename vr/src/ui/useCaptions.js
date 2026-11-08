import { useCallback, useState } from 'react'

// Captions are opt-in: by default nothing sits over or under the interviewer,
// so the room reads like a real interview. One switch for headset and desktop,
// remembered on this device. Screen readers still get every line (Overlay's
// live region does not depend on this).

const KEY = 'skillit.vr.captions'

function read() {
  try {
    return localStorage.getItem(KEY) === 'on'
  } catch {
    return false
  }
}

export function useCaptions() {
  const [on, setOn] = useState(read)
  const toggle = useCallback(() => {
    setOn((was) => {
      const next = !was
      try {
        localStorage.setItem(KEY, next ? 'on' : 'off')
      } catch {
        // storage blocked: the choice lasts for this visit
      }
      return next
    })
  }, [])
  return { on, toggle }
}
