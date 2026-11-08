import { useState } from 'react'
import { recordingNote, reviewRows } from '../review/moments.js'
import { C, Label, Panel, PulseDot, SECONDARY, Shape } from './Panels.jsx'

// The headset's replay: every moment of the interview with its time, and "play from here" on each, in the same
// smoked glass as the other panels. The open moment's note, rewrite and sources sit at the bottom.

const WIDTH = 0.62
const HEIGHT = 0.66
const ROW_H = 0.056
const PAGE = 6
const LEFT = -WIDTH / 2 + 0.035
const RIGHT = WIDTH / 2 - 0.035

function Row({ row, isOpen, isPlaying, playable, onPick, position, reducedMotion }) {
  const [hovered, setHovered] = useState(false)
  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation()
        onPick(row)
      }}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <Shape width={WIDTH - 0.04} height={ROW_H - 0.006} radius={0.014} color={C.sheen} opacity={isOpen ? 0.12 : hovered ? 0.08 : 0.025} order={5} />
      {isPlaying ? (
        <PulseDot color={C.red} position={[LEFT + 0.012, 0, 0.001]} reducedMotion={reducedMotion} />
      ) : (
        <mesh position={[LEFT + 0.012, 0, 0.001]} renderOrder={6}>
          <circleGeometry args={[0.007, 20]} />
          <meshBasicMaterial color={C[row.tone] ?? C.grey} toneMapped={false} transparent opacity={row.tone === 'grey' ? 0.6 : 1} depthWrite={false} />
        </mesh>
      )}
      <Label size={0.0175} bold anchorX="left" anchorY="middle" position={[LEFT + 0.032, 0, 0.001]} maxWidth={WIDTH - (row.researched ? 0.33 : 0.2)}>
        {row.title}
      </Label>
      {row.researched && (
        <Label size={0.013} color={C.blue} anchorX="right" anchorY="middle" position={[RIGHT - 0.125, 0, 0.001]}>
          Researched
        </Label>
      )}
      <Label size={0.0155} opacity={SECONDARY} anchorX="right" anchorY="middle" position={[RIGHT - (playable ? 0.055 : 0), 0, 0.001]}>
        {row.when}
      </Label>
      {playable && (
        <Label size={0.0155} bold color={C.blue} anchorX="right" anchorY="middle" position={[RIGHT, 0, 0.001]}>
          {isPlaying ? 'Stop' : 'Play'}
        </Label>
      )}
    </group>
  )
}

function OpenMoment({ row, position }) {
  if (!row) return null
  const sources = row.sources.length ? `Sources: ${row.sources.join(' · ')}` : null
  return (
    <group position={position}>
      <Label size={0.0165} anchorX="left" anchorY="top" position={[LEFT, 0, 0]} maxWidth={WIDTH - 0.07} lineHeight={1.3}>
        {row.detail}
      </Label>
      {row.better && (
        <Label size={0.0155} color={C.green} anchorX="left" anchorY="top" position={[LEFT, -0.062, 0]} maxWidth={WIDTH - 0.07} lineHeight={1.3}>
          {`Try: ${row.better}`}
        </Label>
      )}
      {sources && (
        <Label size={0.0135} color={C.blue} anchorX="left" anchorY="top" position={[LEFT, -0.122, 0]} maxWidth={WIDTH - 0.07}>
          {sources}
        </Label>
      )}
    </group>
  )
}

/** `review` comes from useReview. Picking a row opens it and, once the audio is loaded, plays from that moment. */
export function ReviewMoments({ review, position, rotation, reducedMotion }) {
  const [page, setPage] = useState(0)
  const [openId, setOpenId] = useState(null)
  const rows = reviewRows(review.replay)
  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE)
  const top = HEIGHT / 2 - 0.04
  const open = rows.find((r) => r.id === openId) ?? null

  const pick = (row) => {
    setOpenId(row.id)
    if (review.playingId === row.id) review.pause()
    else if (row.canPlay && review.audioReady) review.playFrom(row)
  }

  return (
    <group position={position} rotation={rotation}>
      <Panel width={WIDTH} height={HEIGHT}>
        <Label size={0.0175} opacity={SECONDARY} anchorX="left" anchorY="top" position={[LEFT, top, 0]}>
          Review
        </Label>
        <Label size={0.0145} opacity={SECONDARY} anchorX="right" anchorY="top" position={[RIGHT, top, 0]} maxWidth={WIDTH * 0.7}>
          {review.failed ? "Couldn't load this review." : recordingNote(review.replay)}
        </Label>
        {review.replay && rows.length === 0 && (
          <Label size={0.019} anchorX="left" anchorY="top" position={[LEFT, top - 0.06, 0]}>
            Nothing stood out in this one.
          </Label>
        )}
        {shown.map((row, i) => (
          <Row
            key={row.id}
            row={row}
            isOpen={row.id === openId}
            isPlaying={row.id === review.playingId}
            playable={row.canPlay && review.audioReady}
            onPick={pick}
            position={[0, top - 0.065 - i * ROW_H, 0]}
            reducedMotion={reducedMotion}
          />
        ))}
        {pages > 1 && (
          <group position={[RIGHT - 0.06, top - 0.065 - PAGE * ROW_H + 0.01, 0]} onClick={(e) => (e.stopPropagation(), setPage((p) => (p + 1) % pages))}>
            <Shape width={0.12} height={0.034} radius={0.017} color={C.sheen} opacity={0.08} order={5} />
            <Label size={0.0145} anchorX="center" anchorY="middle" position={[0, 0, 0.001]}>
              {`More ${page + 1}/${pages}`}
            </Label>
          </group>
        )}
        <OpenMoment row={open} position={[0, -HEIGHT / 2 + 0.17, 0]} />
      </Panel>
    </group>
  )
}
