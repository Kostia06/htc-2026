// The resume on screen and how it stands against the saved copy.
//   source 'saved':   the person's resume; every edit saves in the background, one save after another.
//   source 'profile': the profile laid out as a resume by the server, not saved yet; the first edit or Save keeps it.
//   source 'upload':  read from a file just now; edits stay on screen until the person saves or discards it.
import { useCallback, useEffect, useRef, useState } from 'react'
import { RESUME_MAX_BYTES, resumeApi } from '../../lib/client'
import { useOnUpdatesApplied } from '../../lib/hooks'
import { normalizeResume } from './resumeDoc'

export function useResume() {
  const [state, setState] = useState({ phase: 'loading' })
  const [saving, setSaving] = useState('idle') // idle | saving | failed
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState(null)
  const current = useRef(state)
  const queue = useRef(Promise.resolve())
  const latestSave = useRef(0)
  // bumps each time a different resume arrives (from the server or a file), so views tied to the old one can reset
  const generation = useRef(0)
  useEffect(() => {
    current.current = state
  })

  const fetchResume = useCallback(
    () =>
      resumeApi.load().then(
        (r) =>
          setState({ phase: 'ready', resume: normalizeResume(r.resume), source: r.saved ? 'saved' : 'profile', file: null, generation: ++generation.current }),
        (e) => setState((s) => (s.resume ? s : { phase: 'failed', message: e.message })),
      ),
    [],
  )
  useEffect(() => {
    fetchResume()
  }, [fetchResume])
  // the profile fills the resume's blanks, so a quick update can change it; a file still being checked is left alone
  useOnUpdatesApplied(() => {
    if (current.current.source !== 'upload') fetchResume()
  })

  /** Starts over from the server: after a failed load, or to drop a file that wasn't saved. */
  const load = useCallback(() => {
    setState({ phase: 'loading' })
    return fetchResume()
  }, [fetchResume])

  /** Queues a save behind any still running; only the newest one decides what the status line says. */
  const persist = useCallback((resume) => {
    const id = ++latestSave.current
    setSaving('saving')
    const run = queue.current.then(() => resumeApi.save(resume))
    queue.current = run.catch(() => {})
    return run.then(
      (saved) => {
        if (id !== latestSave.current) return
        setSaving('idle')
        // a file imported while this save was in flight is still unsaved, so only the resume that was sent counts
        setState((s) => (s.resume === resume ? { ...s, source: 'saved', file: null, resume: { ...resume, updatedAt: saved?.updatedAt ?? resume.updatedAt } } : s))
      },
      () => id === latestSave.current && setSaving('failed'),
    )
  }, [])

  /** Shows the change at once; saves it unless it belongs to a file that hasn't been saved yet. */
  const update = useCallback(
    (next) => {
      setState((s) => ({ ...s, resume: next }))
      if (current.current.source !== 'upload') persist(next)
    },
    [persist],
  )

  const save = useCallback(() => persist(current.current.resume), [persist])

  const importFile = useCallback(async (file) => {
    if (!file) return
    setImportError(null)
    if (file.size > RESUME_MAX_BYTES) {
      setImportError('That file is over 5 MB. Try a smaller copy or a PDF.')
      return
    }
    setImporting(true)
    try {
      const r = await resumeApi.upload(file)
      setState({
        phase: 'ready',
        resume: normalizeResume(r.resume),
        source: 'upload',
        file: { name: file.name, droppedClaims: r.droppedClaims ?? 0 },
        generation: ++generation.current,
      })
      setSaving('idle')
    } catch (e) {
      setImportError(e.message)
    } finally {
      setImporting(false)
    }
  }, [])

  /** Drops the file's version and goes back to whatever is saved (or the profile, if nothing is). */
  const discard = load

  // a file that was read but not saved is lost on reload, so the browser asks first
  const unsaved = state.source === 'upload'
  useEffect(() => {
    if (!unsaved) return
    const warn = (e) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [unsaved])

  return { ...state, saving, importing, importError, load, update, save, importFile, discard }
}
