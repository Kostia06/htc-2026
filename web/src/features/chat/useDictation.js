// The composer's mic: words land in the draft as they're heard and go out as one message when the mic stops.
import { useRef, useState } from 'react'
import { dictationSupported, startDictation } from '../../lib/dictation'

export function useDictation({ onHeard, onFinished, onError }) {
  const [listening, setListening] = useState(false)
  const stopRef = useRef(null)

  const start = () => {
    if (!dictationSupported || stopRef.current) return
    setListening(true)
    try {
      stopRef.current = startDictation({
        onText: onHeard,
        onEnd: (text) => {
          stopRef.current = null
          setListening(false)
          if (text.trim()) onFinished(text.trim())
          else onError("I couldn't hear you. Type it instead?")
        },
        onError: () => onError("The mic isn't available. Type it instead?"),
      })
    } catch {
      stopRef.current = null
      setListening(false)
      onError("The mic isn't available. Type it instead?")
    }
  }

  const stop = () => stopRef.current?.()

  return dictationSupported ? { listening, onToggle: () => (listening ? stop() : start()) } : null
}
