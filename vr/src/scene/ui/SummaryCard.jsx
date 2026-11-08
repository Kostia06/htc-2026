import { endNotice, practiceLine } from './copy.js'
import { nextLabel } from './reportSteps.js'
import { guessHeight, stack } from '../../theme/layout.js'
import { useTextHeights } from '../../theme/useTextHeights.js'
import { Card, ExampleBadge, Label, ListRow, Logo, RaisedButton, ScoreHeadline, SectionTitle, size, space, type } from '../../theme/index.js'

const WIDTH = 0.8
const PAD = space.l
const INNER = WIDTH - PAD * 2
const LEFT = -WIDTH / 2 + PAD
const HEADER_H = 0.06 // logo and "How it went"
const KEY_H = size.buttonHeight // Back / Next along the bottom
const KEYS_H = KEY_H
const ROW_GAP = 0.022

/**
 * The end of the interview, one step at a time (reportSteps.js): the score and
 * verdict, then the top tips three to a page, then a pointer to the moments on
 * the right. The card hangs from its top edge, so a taller step grows down
 * toward the desk and never up over the interviewer's face.
 */
export function SummaryCard({ summary, meta, sample, steps, index = 0, onNext, onBack, onPracticeAgain, reducedMotion, ...props }) {
  const step = steps?.[index] ?? { kind: 'notice' }
  if (step.kind === 'notice') {
    return <EndNotice status={summary?.status} onBack={onPracticeAgain} reducedMotion={reducedMotion} {...props} />
  }
  const last = index >= steps.length - 1
  return (
    <StepBody
      step={step}
      summary={summary}
      meta={meta}
      sample={sample}
      nextText={nextLabel(steps, index)}
      onNext={last ? onPracticeAgain : onNext}
      onBack={index > 0 ? onBack : null}
      reducedMotion={reducedMotion}
      {...props}
    />
  )
}

function StepBody({ step, summary, meta, sample, nextText, onNext, onBack, reducedMotion, ...props }) {
  const { measure, heightOf } = useTextHeights()
  let body
  let bodyH
  if (step.kind === 'score') {
    const verdict = summary.verdict ?? summary.summary
    const practised = practiceLine(meta)
    const verdictH = verdict ? heightOf('verdict', guessHeight(verdict, type.title3, INNER)) : 0
    const practisedH = practised ? heightOf('practised', guessHeight(practised, type.footnote, INNER)) + space.s : 0
    const scoreH = type.score * 1.18
    bodyH = scoreH + verdictH + practisedH
    body = (
      <>
        <ScoreHeadline score={summary.overall} verdict={verdict} maxWidth={INNER} onVerdictSync={measure('verdict')} reducedMotion={reducedMotion} />
        {practised && (
          <Label variant="footnote" tone="text2" anchorX="left" anchorY="top" maxWidth={INNER} position={[0, -scoreH - verdictH - space.s, 0]} onSync={measure('practised')}>
            {`You practised for ${practised}`}
          </Label>
        )}
      </>
    )
  } else if (step.kind === 'tips') {
    const title = step.pages > 1 ? `Top tips ${step.page + 1}/${step.pages}` : 'Top tips'
    const heights = step.items.map((tip, i) => heightOf(`tip${i}`, guessHeight(tip, type.body, INNER - 0.03)))
    const { tops, total } = stack(heights, ROW_GAP)
    const titleH = type.headline * 1.28 + space.m
    bodyH = titleH + total
    body = (
      <>
        <SectionTitle>{title}</SectionTitle>
        {step.items.map((tip, i) => (
          <ListRow key={`${step.page}-${i}`} text={tip} width={INNER} onSync={measure(`tip${i}`)} position={[0, -titleH - tops[i], 0]} />
        ))}
      </>
    )
  } else {
    const line = 'Point at a moment on your right to hear that part of your answer again.'
    const titleH = type.headline * 1.28 + space.s
    bodyH = titleH + heightOf('moments', guessHeight(line, type.callout, INNER))
    body = (
      <>
        <SectionTitle>Moments</SectionTitle>
        <Label variant="callout" tone="text2" anchorX="left" anchorY="top" lineHeight={1.3} maxWidth={INNER} position={[0, -titleH, 0]} onSync={measure('moments')}>
          {line}
        </Label>
      </>
    )
  }

  const height = PAD * 2 + HEADER_H + bodyH + space.m + KEYS_H
  const top = height / 2 - PAD
  const keyY = -height / 2 + PAD + KEY_H / 2
  const keyW = onBack ? (INNER - space.s) / 2 : INNER
  return (
    <group {...props}>
      <group position={[0, -height / 2, 0]}>
        <Card width={WIDTH} height={height}>
          <Logo size={0.04} position={[LEFT + 0.02, top - 0.02, 0.001]} />
          <Label variant="subhead" weight="semibold" tone="text2" anchorX="left" anchorY="middle" position={[LEFT + 0.052, top - 0.02, 0]}>
            How it went
          </Label>
          {sample && <ExampleBadge position={[WIDTH / 2 - PAD - 0.07, top - 0.02, 0]} />}
          <group position={[LEFT, top - HEADER_H, 0]}>{body}</group>
          {onBack && (
            <RaisedButton
              label="Back"
              tone="secondary"
              width={keyW}
              height={KEY_H}
              onPress={onBack}
              reducedMotion={reducedMotion}
              position={[LEFT + keyW / 2, keyY, 0.002]}
            />
          )}
          <RaisedButton
            label={nextText}
            width={keyW}
            height={KEY_H}
            onPress={onNext}
            reducedMotion={reducedMotion}
            position={[WIDTH / 2 - PAD - keyW / 2, keyY, 0.002]}
          />
        </Card>
      </group>
    </group>
  )
}

// While the report is on its way, or when there is none: still a card, and
// always a way back to the menu, so the room never ends on an empty stage.
function EndNotice({ status, onBack, reducedMotion, ...props }) {
  const { title, body } = endNotice(status)
  const { measure, heightOf } = useTextHeights()
  const titleH = heightOf('title', guessHeight(title, type.title3, INNER))
  const bodyH = heightOf('body', guessHeight(body, type.footnote, INNER))
  const height = PAD * 2 + HEADER_H + titleH + space.s + bodyH + space.m + KEYS_H
  const top = height / 2 - PAD
  return (
    <group {...props}>
      <group position={[0, -height / 2, 0]}>
        <Card width={WIDTH} height={height}>
          <Logo size={0.04} position={[LEFT + 0.02, top - 0.02, 0.001]} />
          <Label variant="subhead" weight="semibold" tone="text2" anchorX="left" anchorY="middle" position={[LEFT + 0.052, top - 0.02, 0]}>
            How it went
          </Label>
          <Label variant="title3" weight="semibold" anchorX="left" anchorY="top" maxWidth={INNER} position={[LEFT, top - HEADER_H, 0]} onSync={measure('title')}>
            {title}
          </Label>
          <Label
            variant="footnote"
            tone="text2"
            anchorX="left"
            anchorY="top"
            maxWidth={INNER}
            position={[LEFT, top - HEADER_H - titleH - space.s, 0]}
            onSync={measure('body')}
          >
            {body}
          </Label>
          <RaisedButton label="Back to menu" width={INNER} height={KEY_H} onPress={onBack} reducedMotion={reducedMotion} position={[0, -height / 2 + PAD + KEY_H / 2, 0.002]} />
        </Card>
      </group>
    </group>
  )
}
