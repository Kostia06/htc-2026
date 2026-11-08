// The tailored versions the person saved, newest change first; the sheets call `reload` after they change one.
import { useCallback, useEffect, useState } from 'react'
import { tailoredApi } from '../../../lib/client'

export function useTailoredList() {
  const [state, setState] = useState({ items: [], loaded: false, failed: false })

  const reload = useCallback(
    () =>
      tailoredApi.list().then(
        (items) => setState({ items, loaded: true, failed: false }),
        // keep what's on screen; only an empty list that never loaded says so
        () => setState((s) => ({ ...s, loaded: true, failed: s.items.length === 0 })),
      ),
    [],
  )

  useEffect(() => {
    reload()
  }, [reload])

  return { ...state, reload }
}
