import { useCallback, useState } from 'react'

// Measured heights of troika text, by key. `measure(key)` is an `onSync`
// handler for a Label; `heightOf(key, guess)` is the measured height, or the
// guess until the first layout lands.
export function useTextHeights() {
  const [heights, setHeights] = useState({})
  const measure = useCallback(
    (key) => (mesh) => {
      const bounds = mesh?.textRenderInfo?.blockBounds
      if (!bounds) return
      const height = bounds[3] - bounds[1]
      // onSync runs after every render; only a real change may re-render
      setHeights((prev) => (Math.abs((prev[key] ?? -1) - height) < 1e-4 ? prev : { ...prev, [key]: height }))
    },
    [],
  )
  const heightOf = useCallback((key, guess) => heights[key] ?? guess, [heights])
  return { measure, heightOf }
}
