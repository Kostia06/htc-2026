import { useState } from 'react'
import { recordingNote, reviewRows } from '../review/moments.js'
import { Card, Label, RaisedButton, Surface, color, flat, space, type, usePressable } from '../theme/index.js'

// The headset's replay: every moment of the interview with its time, and "play
// from here" on each, as an app card. The open moment's note, rewrite and
// sources sit at the bottom.

// the score card's footprint (ScoreCard.jsx), so the two read as a pair
const WIDTH = 0.64
const PAD = space.l
const LEFT = -WIDTH / 2 + PAD
const RIGHT = WIDTH / 2 - PAD
const ROW_H = 0.06
const PAGE = 4
const OPEN_H = 0.17
const HEADER_H = 0.09 // title, then the recording note under it
const MORE_H = 0.08 // the More key, between the rows and the open moment
const HEIGHT = PAD * 2 + HEADER_H + PAGE * ROW_H + MORE_H + OPEN_H

// moments.js names its dots in the old palette; in the app's meaning: good is
// teal, needs work is coral, anything the AI suggests or researched is sand.
const TONE = {
  green: color.positive,
  red: color.negative,
  orange: color.negative,
  blue: color.agent,
  grey: color.text2,
}

function Row({ row, isOpen, isPlaying, playable, onPick, position, reducedMotion }) {
  const { hovered, handlers } = usePressable({ onPress: () => onPick(row), reducedMotion })
  const inner = WIDTH - PAD * 2
  return (
    <group position={position} {...handlers}>
      <Surface width={inner + 0.02} height={ROW_H - 0.008} radius={0.016} face={isOpen || hovered ? color.inset : color.raised} />
      <mesh position={[LEFT + 0.012, 0, 0.001]} material={flat(isPlaying ? color.action : TONE[row.tone] ?? color.text2)}>
        <circleGeometry args={[isPlaying ? 0.009 : 0.007, 20]} />
      </mesh>
      <Label variant="subhead" weight="semibold" anchorX="left" anchorY="middle" position={[LEFT + 0.032, 0, 0.001]} maxWidth={inner - (row.researched ? 0.3 : 0.18)}>
        {row.title}
      </Label>
      {row.researched && (
        <Label variant="caption" weight="semibold" tone="agent" anchorX="right" anchorY="middle" position={[RIGHT - 0.13, 0, 0.001]}>
          Researched
        </Label>
      )}
      <Label variant="footnote" tone="text2" anchorX="right" anchorY="middle" position={[RIGHT - (playable ? 0.065 : 0), 0, 0.001]}>
        {row.when}
      </Label>
      {playable && (
        <Label variant="subhead" weight="semibold" tone="action" anchorX="right" anchorY="middle" position={[RIGHT, 0, 0.001]}>
          {isPlaying ? 'Stop' : 'Play'}
        </Label>
      )}
    </group>
  )
}

function OpenMoment({ row, position }) {
  if (!row) return null
  const width = WIDTH - PAD * 2
  const sources = row.sources.length ? `Sources: ${row.sources.join(' · ')}` : null
  return (
    <group position={position}>
      <Label variant="callout" anchorX="left" anchorY="top" position={[LEFT, 0, 0]} maxWidth={width} lineHeight={1.3}>
        {row.detail}
      </Label>
      {row.better && (
        <Label variant="footnote" tone="agent" anchorX="left" anchorY="top" position={[LEFT, -type.callout * 2.7, 0]} maxWidth={width} lineHeight={1.3}>
          {`Try: ${row.better}`}
        </Label>
      )}
      {sources && (
        <Label variant="caption" tone="text2" anchorX="left" anchorY="top" position={[LEFT, -type.callout * 2.7 - type.footnote * 2.8, 0]} maxWidth={width}>
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
  const top = HEIGHT / 2 - PAD
  const open = rows.find((r) => r.id === openId) ?? null

  const pick = (row) => {
    setOpenId(row.id)
    if (review.playingId === row.id) review.pause()
    else if (row.canPlay && review.audioReady) review.playFrom(row)
  }

  return (
    <group position={position} rotation={rotation}>
      <Card width={WIDTH} height={HEIGHT}>
        <Label variant="headline" anchorX="left" anchorY="top" position={[LEFT, top, 0]}>
          Review
        </Label>
        <Label variant="footnote" tone="text2" anchorX="left" anchorY="top" position={[LEFT, top - 0.042, 0]} maxWidth={WIDTH - PAD * 2}>
          {review.failed ? "Couldn't load this review." : recordingNote(review.replay)}
        </Label>
        {review.replay && rows.length === 0 && (
          <Label variant="body" anchorX="left" anchorY="top" position={[LEFT, top - HEADER_H - 0.01, 0]}>
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
            position={[0, top - HEADER_H - ROW_H / 2 - i * ROW_H, 0]}
            reducedMotion={reducedMotion}
          />
        ))}
        {pages > 1 && (
          <RaisedButton
            label={`More ${page + 1}/${pages}`}
            tone="chip"
            variant="footnote"
            width={0.14}
            height={0.044}
            radius={0.022}
            onPress={() => setPage((p) => (p + 1) % pages)}
            reducedMotion={reducedMotion}
            position={[RIGHT - 0.07, top - HEADER_H - PAGE * ROW_H - MORE_H / 2, 0.003]}
          />
        )}
        <OpenMoment row={open} position={[0, -HEIGHT / 2 + PAD + OPEN_H, 0]} />
      </Card>
    </group>
  )
}
