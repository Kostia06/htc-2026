import { useState } from 'react'
import { recordingNote, reviewRows } from '../review/moments.js'
import { Card, Label, RaisedButton, Surface, color, flat, space, type, usePressable } from '../theme/index.js'
import { guessHeight, stack } from '../theme/layout.js'
import { useTextHeights } from '../theme/useTextHeights.js'

// The headset's replay: every moment of the interview with its time, and "play
// from here" on each, as an app card. The open moment's note, rewrite and
// sources sit at the bottom.

// the score card's footprint (ScoreCard.jsx), so the two read as a pair
const WIDTH = 0.7
const PAD = space.l
const INNER = WIDTH - PAD * 2
const LEFT = -WIDTH / 2 + PAD
const RIGHT = WIDTH / 2 - PAD
const ROW_H = 0.078 // room for a title that wraps to two lines
const PAGE = 4
const HEADER_H = 0.09 // title, then the recording note under it
const NAV_H = 0.07 // the Back / Next keys, between the rows and the open moment
const KEY_H = 0.048
const GAP = 0.012
const ROWS_H = HEADER_H + PAGE * ROW_H + NAV_H

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
      <Label
        variant="subhead"
        weight="semibold"
        anchorX="left"
        anchorY="middle"
        position={[LEFT + 0.032, 0, 0.001]}
        maxWidth={inner - 0.032 - (row.researched ? 0.3 : 0.18)}
        overflowWrap="break-word"
      >
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

// The open moment's note, rewrite and sources, stacked by their measured heights.
function openBlocks(row) {
  if (!row) return []
  return [
    { key: 'detail', text: row.detail, variant: 'callout', tone: 'text' },
    row.better && { key: 'better', text: `Try: ${row.better}`, variant: 'footnote', tone: 'agent' },
    row.sources.length && { key: 'sources', text: `Sources: ${row.sources.join(' · ')}`, variant: 'caption', tone: 'text2' },
  ].filter((block) => block && block.text)
}

function OpenMoment({ blocks, tops, measure, position }) {
  return (
    <group position={position}>
      {blocks.map((block, i) => (
        <Label
          key={block.key}
          variant={block.variant}
          tone={block.tone}
          anchorX="left"
          anchorY="top"
          position={[LEFT, -tops[i], 0]}
          maxWidth={INNER}
          lineHeight={1.3}
          onSync={measure(block.key)}
        >
          {block.text}
        </Label>
      ))}
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
  const open = rows.find((r) => r.id === openId) ?? null
  const { measure, heightOf } = useTextHeights()
  const blocks = openBlocks(open)
  const { tops, total } = stack(
    blocks.map((b) => heightOf(b.key, guessHeight(b.text, type[b.variant], INNER, 1.3))),
    GAP,
  )
  const height = PAD * 2 + ROWS_H + (blocks.length ? total + GAP : 0)
  const top = height / 2 - PAD
  const navY = top - HEADER_H - PAGE * ROW_H - NAV_H / 2
  const keyW = 0.14

  const pick = (row) => {
    setOpenId(row.id)
    if (review.playingId === row.id) review.pause()
    else if (row.canPlay && review.audioReady) review.playFrom(row)
  }

  return (
    <group position={position} rotation={rotation}>
      <Card width={WIDTH} height={height}>
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
          <>
            <Label variant="footnote" tone="text2" anchorX="left" anchorY="middle" position={[LEFT, navY, 0]}>
              {`${page + 1} of ${pages}`}
            </Label>
            <RaisedButton
              label="Back"
              tone="chip"
              variant="footnote"
              width={keyW}
              height={KEY_H}
              radius={KEY_H / 2}
              disabled={page === 0}
              onPress={() => setPage((p) => Math.max(p - 1, 0))}
              reducedMotion={reducedMotion}
              position={[RIGHT - keyW * 1.5 - space.s, navY, 0.003]}
            />
            <RaisedButton
              label="Next"
              tone="chip"
              variant="footnote"
              width={keyW}
              height={KEY_H}
              radius={KEY_H / 2}
              disabled={page >= pages - 1}
              onPress={() => setPage((p) => Math.min(p + 1, pages - 1))}
              reducedMotion={reducedMotion}
              position={[RIGHT - keyW / 2, navY, 0.003]}
            />
          </>
        )}
        <OpenMoment blocks={blocks} tops={tops} measure={measure} position={[0, top - ROWS_H, 0]} />
      </Card>
    </group>
  )
}
