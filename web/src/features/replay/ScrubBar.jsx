// ReplayScrubBar.swift: the playback bar with a coloured dot at every moment. The range input gives keyboard
// and screen-reader scrubbing for free; the dots are buttons laid over it.
import { clock, dotPositions, KINDS, momentId, spokenLabel } from './replay'

export default function ScrubBar({ replay, time, duration, selectedId, onSeek, onSelect }) {
  const positions = dotPositions(replay.moments, duration)
  const progress = duration > 0 ? Math.min(100, (time / duration) * 100) : 0
  return (
    <div className="scrub" style={{ '--progress': `${progress}%` }}>
      <input
        type="range"
        className="scrub__range"
        min={0}
        max={Math.max(1, duration)}
        step={1}
        value={Math.min(time, duration)}
        onChange={(e) => onSeek(Number(e.target.value))}
        aria-label="Playback position"
        aria-valuetext={`${clock(time)} of ${clock(duration)}`}
      />
      {replay.moments.map((m) => {
        const id = momentId(m)
        return (
          <button
            key={id}
            type="button"
            className={`scrub__dot${id === selectedId ? ' is-selected' : ''}`}
            style={{ left: `${positions.get(id)}%`, '--dot': KINDS[m.kind]?.color }}
            aria-label={spokenLabel(replay, m)}
            aria-pressed={id === selectedId}
            onClick={() => onSelect(m)}
          />
        )
      })}
    </div>
  )
}
