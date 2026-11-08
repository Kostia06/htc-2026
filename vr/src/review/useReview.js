import { useCallback, useEffect, useRef, useState } from 'react'
import { SignedOutError } from '../headset/api.js'
import { fetchReplay, fetchReplayAudio } from './api.js'

// ElevenLabs finishes the recording a little after the call ends, so a fresh review asks again a few times
const PROCESSING_RETRY_MS = 5000
const PROCESSING_TRIES = 6

// Returns { sessionId, replay, failed, audioReady, playingId, open(id), close(), playFrom(row), pause() }.
// The token is read through a ref so a silent refresh doesn't reload the review and stop the audio.
export function useReview({ token, onSignedOut } = {}) {
  const tokenRef = useRef(token)
  tokenRef.current = token
  const onSignedOutRef = useRef(onSignedOut)
  onSignedOutRef.current = onSignedOut

  const [sessionId, setSessionId] = useState(null)
  const [replay, setReplay] = useState(null)
  const [failed, setFailed] = useState(false)
  const [audioReady, setAudioReady] = useState(false)
  const [playingId, setPlayingId] = useState(null)
  const audio = useRef(null)

  useEffect(() => {
    if (!sessionId) return undefined
    let alive = true
    let timer = null
    let objectUrl = null

    const loadAudio = async () => {
      const blob = await fetchReplayAudio(tokenRef.current, sessionId)
      if (!alive) return
      objectUrl = URL.createObjectURL(blob)
      const element = new Audio(objectUrl)
      element.onended = () => alive && setPlayingId(null)
      audio.current = element
      setAudioReady(true)
    }

    const load = async (tries) => {
      try {
        const next = await fetchReplay(tokenRef.current, sessionId)
        if (!alive) return
        setReplay(next)
        if (next.recording === 'processing' && tries > 1) timer = setTimeout(() => load(tries - 1), PROCESSING_RETRY_MS)
        else if (next.audioUrl) await loadAudio()
      } catch (error) {
        if (!alive) return
        if (error instanceof SignedOutError) onSignedOutRef.current?.()
        else setFailed(true)
      }
    }
    void load(PROCESSING_TRIES)

    return () => {
      alive = false
      clearTimeout(timer)
      audio.current?.pause()
      audio.current = null
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [sessionId])

  const openId = useRef(null)
  openId.current = sessionId

  // opening the review that's already up is a no-op, so it never wipes a loaded replay and stops the audio
  const open = useCallback((id) => {
    if (!id || id === openId.current) return
    setReplay(null)
    setFailed(false)
    setAudioReady(false)
    setPlayingId(null)
    setSessionId(id)
  }, [])

  const close = useCallback(() => {
    setSessionId(null)
    setReplay(null)
    setAudioReady(false)
    setPlayingId(null)
  }, [])

  // the moment's time already sits a second and a half before the answer, so playback catches its first words
  const playFrom = useCallback((row) => {
    const element = audio.current
    if (!element || !row?.canPlay) return
    element.currentTime = row.t
    element.play().catch(() => setPlayingId(null))
    setPlayingId(row.id)
  }, [])

  const pause = useCallback(() => {
    audio.current?.pause()
    setPlayingId(null)
  }, [])

  return { sessionId, replay, failed, audioReady, playingId, open, close, playFrom, pause }
}
