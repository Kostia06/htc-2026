// The two halves of the Profile tab's state: editing the profile (shared by the You page and Skills & experience),
// and the facts the You page shows on its doors (ProfileOverviewModel.swift).
import { useCallback, useEffect, useRef, useState } from 'react'
import { normalizeProfile, useApp } from '../../app/context'
import { headsetApi, postingsApi, profileApi, roadmapApi, tailoredApi } from '../../lib/client'
import { applyEdit } from './edits'
import { weakestTailored } from './nextMove'

/** Every edit shows at once and saves in the background; a refused save puts the server's copy back. */
export function useProfileEdit() {
  const app = useApp()
  const profile = app.profile ?? normalizeProfile()
  const [flash, setFlash] = useState(null)
  const profileRef = useRef(profile)
  useEffect(() => {
    profileRef.current = profile
  })

  useEffect(() => {
    app.refreshProfile().catch(() => {})
    // once when the screen opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const edit = useCallback(
    (change) => {
      const result = applyEdit(profileRef.current, change)
      if (!result) return
      const [next, patch] = result
      app.setProfile(next)
      profileApi.patch(patch).then(
        (saved) => {
          if (saved) app.setProfile(normalizeProfile(saved))
          setFlash({ message: 'Saved', tone: 'positive' })
        },
        (e) => {
          setFlash({ message: `Couldn't save. ${e.message}`, tone: 'negative' })
          app.refreshProfile().catch(() => {})
        },
      )
    },
    [app],
  )

  return { profile, loading: !app.profile, edit, flash, clearFlash: () => setFlash(null) }
}

/** Each fact loads on its own, so one slow or failing call leaves the others on screen. */
export function useProfileOverview() {
  const [state, setState] = useState({ tailored: [], postings: [], road: null, headsets: null, missingTopic: null, loaded: false })

  useEffect(() => {
    let live = true
    const set = (patch) => live && setState((s) => ({ ...s, ...patch }))
    const tailored = tailoredApi.list().catch(() => [])
    Promise.all([tailored, postingsApi.list().catch(() => [])]).then(async ([items, postings]) => {
      const weakest = weakestTailored(items)
      const full = weakest ? await tailoredApi.get(weakest.id).catch(() => null) : null
      const missing = full?.match?.missing ?? []
      set({ tailored: items, postings, missingTopic: (missing.find((m) => m.required) ?? missing[0])?.topic ?? null, loaded: true })
    })
    roadmapApi
      .page()
      .then((page) => set({ road: page.progress }))
      .catch(() => {})
    headsetApi
      .status()
      .then((status) => set({ headsets: status.devices?.length ?? 0 }))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  return state
}
