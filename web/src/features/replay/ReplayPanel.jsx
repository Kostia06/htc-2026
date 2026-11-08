// ReplayView.swift for the web: the recording with a dot at every moment and the transcript on the left,
// the moments as a feed on the right (stacked on narrow screens). Degrades to transcript-only without a recording.
import { useCallback, useEffect, useRef, useState } from 'react'
import { AudioWaveform, Pause, Play } from 'lucide-react'
import { voiceApi } from '../../lib/client'
import { SkeletonLines } from '../../ui/Feedback'
import { MomentCard, MomentFeed } from './Moments'
import { clock, lineIndex, momentId } from './replay'
import ScrubBar from './ScrubBar'
import './replay.css'

// ElevenLabs finishes a recording a little after the call ends, so a fresh report asks again a few times
const PROCESSING_RETRY_MS = 5000
const PROCESSING_TRIES = 6

function useReplay(sessionId) {
  const [replay, setReplay] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const [audioFailed, setAudioFailed] = useState(false)

  useEffect(() => {
    if (!sessionId) return
    let alive = true
    let objectUrl = null
    let timer = null
    const load = async (tries) => {
      const next = await voiceApi.replay(sessionId).catch(() => null)
      if (!alive || !next) return
      setReplay(next)
      if (next.recording === 'processing' && tries > 1) timer = setTimeout(() => load(tries - 1), PROCESSING_RETRY_MS)
      if (!next.audioUrl) return
      try {
        objectUrl = URL.createObjectURL(await voiceApi.replayAudio(sessionId))
        if (alive) setAudioUrl(objectUrl)
      } catch {
        if (alive) setAudioFailed(true)
      }
    }
    load(PROCESSING_TRIES)
    return () => {
      alive = false
      clearTimeout(timer)
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [sessionId])

  return { replay, audioUrl, audioFailed }
}

function note(replay, audioUrl, audioFailed) {
  if (replay.recording === 'processing') return 'The recording is still being processed. It will appear here in a moment.'
  if (replay.recording === 'none') return "This session wasn't recorded, so here's what was said."
  if (audioFailed) return "Couldn't load the recording. The moments and transcript are still here."
  if (!audioUrl) return 'Loading the recording…'
  return null
}

export default function ReplayPanel({ sessionId }) {
  const { replay, audioUrl, audioFailed } = useReplay(sessionId)
  const audio = useRef(null)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [selected, setSelected] = useState(null)
  const [audioDuration, setAudioDuration] = useState(0)
  const card = useRef(null)

  // a moment picked from the feed opens beside the bar; on a narrow screen that's above, so bring it into view
  useEffect(() => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    card.current?.scrollIntoView({ block: 'nearest', behavior: still ? 'auto' : 'smooth' })
  }, [selected])

  const seek = useCallback((t) => {
    setTime(t)
    if (audio.current) audio.current.currentTime = t
  }, [])

  if (!replay) {
    return (
      <section className="replay card" aria-busy="true">
        <SkeletonLines widths={[0.4, 0.95, 0.6]} />
      </section>
    )
  }

  const timed = replay.timing === 'seconds' && replay.durationSec > 0
  const duration = audioDuration || replay.durationSec || 0
  const current = timed && (audioUrl || selected) ? lineIndex(replay.transcript, time) : -1
  const select = (m) => {
    setSelected(m)
    // a second early, so the start of the moment isn't clipped
    if (timed) seek(Math.max(0, m.t - 1))
  }
  const message = note(replay, audioUrl, audioFailed)

  return (
    <section className="replay" aria-label="Replay">
      <div className="replay__main card">
        <h2 className="t-headline">Replay</h2>
        {audioUrl && (
          <audio
            ref={audio}
            src={audioUrl}
            preload="auto"
            onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setAudioDuration(e.currentTarget.duration)}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
          />
        )}
        {timed && (
          <div className="replay__player">
            <div className="row replay__controls">
              {audioUrl && (
                <button
                  type="button"
                  className="replay__play"
                  aria-label={playing ? 'Pause' : 'Play'}
                  onClick={() => (playing ? audio.current?.pause() : audio.current?.play())}
                >
                  {playing ? <Pause size={20} fill="currentColor" aria-hidden /> : <Play size={20} fill="currentColor" aria-hidden />}
                </button>
              )}
              <span className="t-subhead c-2 mono">
                {clock(time)} / {clock(duration)}
              </span>
            </div>
            <ScrubBar replay={replay} time={time} duration={duration} selectedId={selected && momentId(selected)} onSeek={seek} onSelect={select} />
          </div>
        )}
        {message && (
          <p className="row t-footnote c-2 replay__note">
            <AudioWaveform size={15} aria-hidden /> {message}
          </p>
        )}
        {selected && (
          <div ref={card}>
            <MomentCard replay={replay} moment={selected} />
          </div>
        )}
        <div className="replay__transcript">
          <h3 className="t-subhead semibold c-2">Transcript</h3>
          {replay.transcript.map((line, i) => (
            <button
              key={i}
              type="button"
              className={`replay__line${i === current ? ' is-current' : ''}`}
              disabled={!audioUrl}
              onClick={() => seek(line.t)}
            >
              <span className={`t-caption semibold ${line.speaker === 'agent' ? 'c-agent' : 'c-2'}`}>
                {line.speaker === 'agent' ? 'Interviewer' : 'You'}
              </span>
              <span className="t-body">{line.text}</span>
            </button>
          ))}
        </div>
      </div>
      <aside className="replay__feed card">
        <h2 className="t-headline">Moments</h2>
        <MomentFeed replay={replay} selectedId={selected && momentId(selected)} onSelect={select} />
      </aside>
    </section>
  )
}
