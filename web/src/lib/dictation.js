// Speech to text for the chat composers, the web stand-in for SpeechDictation.swift. Uses the browser's own
// recognizer; where there is none, the mic button is simply not shown.
const Recognition = typeof window !== 'undefined' ? (window.SpeechRecognition ?? window.webkitSpeechRecognition) : undefined

export const dictationSupported = Boolean(Recognition)

/** Starts listening. `onText` gets the transcript so far; `onEnd` the final text when it stops. Returns stop(). */
export function startDictation({ onText, onEnd, onError }) {
  const recognizer = new Recognition()
  recognizer.continuous = true
  recognizer.interimResults = true
  recognizer.lang = navigator.language || 'en-US'
  let text = ''
  recognizer.onresult = (event) => {
    text = [...event.results].map((r) => r[0].transcript).join(' ').replace(/\s+/g, ' ').trim()
    onText(text)
  }
  recognizer.onerror = (event) => {
    if (event.error !== 'no-speech' && event.error !== 'aborted') onError?.(event.error)
  }
  recognizer.onend = () => onEnd(text)
  recognizer.start()
  return () => recognizer.stop()
}
