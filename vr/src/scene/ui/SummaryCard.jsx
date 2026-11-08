import { endNotice, practiceLine } from './copy.js'
import { Card, ExampleBadge, Label, ListRow, Logo, RaisedButton, ScoreHeadline, SectionTitle, space, type } from '../../theme/index.js'

/**
 * The end of the interview, as the phone's SessionSummaryView: the score, the
 * verdict, what to work on next, and one sage button.
 */
export function SummaryCard({ summary, meta, sample, onPracticeAgain, reducedMotion, ...props }) {
  if (summary.status && summary.status !== 'scored') {
    return <EndNotice status={summary.status} onBack={onPracticeAgain} reducedMotion={reducedMotion} {...props} />
  }
  const practised = practiceLine(meta)
  const width = 0.74
  const steps = summary.nextSteps ?? []
  const verdict = summary.verdict ?? summary.summary
  const pad = space.xl
  const inner = width - pad * 2
  // Troika lays text out off-thread, so estimate the verdict's lines to make room.
  const verdictH = Math.ceil(((verdict?.length ?? 0) * type.title3 * 0.55) / inner) * type.title3 * 1.28
  const listH = steps.length ? 0.06 + steps.length * 0.075 : 0
  const practisedH = practised ? 0.045 : 0
  const height = pad * 2 + 0.06 + type.score * 1.18 + verdictH + listH + practisedH + 0.12
  const left = -width / 2 + pad
  const top = height / 2 - pad
  const listTop = top - 0.06 - type.score * 1.18 - verdictH - 0.03

  return (
    <group {...props}>
      <Card width={width} height={height}>
        <Logo size={0.04} position={[left + 0.02, top - 0.02, 0.001]} />
        <Label variant="subhead" weight="semibold" tone="text2" anchorX="left" anchorY="middle" position={[left + 0.052, top - 0.02, 0]}>
          How it went
        </Label>
        {sample && <ExampleBadge position={[width / 2 - pad - 0.07, top - 0.02, 0]} />}

        <ScoreHeadline score={summary.overall} verdict={verdict} maxWidth={inner} position={[left, top - 0.06, 0]} reducedMotion={reducedMotion} />

        {steps.length > 0 && (
          <group position={[left, listTop, 0]}>
            <SectionTitle>Work on next</SectionTitle>
            {steps.map((step, i) => (
              <ListRow key={i} text={step} width={inner} position={[0, -0.045 - i * 0.075, 0]} />
            ))}
          </group>
        )}

        {practised && (
          <Label variant="footnote" tone="text2" anchorX="left" anchorY="bottom" maxWidth={inner} position={[left, -height / 2 + pad + 0.085, 0]}>
            {`You practised for ${practised}`}
          </Label>
        )}

        <RaisedButton
          label="Practice again"
          width={inner}
          onPress={onPracticeAgain}
          reducedMotion={reducedMotion}
          position={[0, -height / 2 + pad + 0.035, 0.002]}
        />
      </Card>
    </group>
  )
}

// While the report is on its way, or when there is none: still a card, and
// always a way back to the menu, so the room never ends on an empty stage.
function EndNotice({ status, onBack, reducedMotion, ...props }) {
  const { title, body } = endNotice(status)
  const width = 0.62
  const pad = space.xl
  const inner = width - pad * 2
  const height = 0.3
  const left = -width / 2 + pad
  const top = height / 2 - pad
  return (
    <group {...props}>
      <Card width={width} height={height}>
        <Logo size={0.04} position={[left + 0.02, top - 0.02, 0.001]} />
        <Label variant="subhead" weight="semibold" tone="text2" anchorX="left" anchorY="middle" position={[left + 0.052, top - 0.02, 0]}>
          How it went
        </Label>
        <Label variant="title3" weight="semibold" anchorX="left" anchorY="top" maxWidth={inner} position={[left, top - 0.06, 0]}>
          {title}
        </Label>
        <Label variant="footnote" tone="text2" anchorX="left" anchorY="top" maxWidth={inner} position={[left, top - 0.06 - type.title3 * 1.5, 0]}>
          {body}
        </Label>
        <RaisedButton label="Back to menu" width={inner} onPress={onBack} reducedMotion={reducedMotion} position={[0, -height / 2 + pad + 0.035, 0.002]} />
      </Card>
    </group>
  )
}
