import { Card, Label, Logo, RaisedButton, TextLink, space } from '../../theme/index.js'

const WIDTH = 0.66

/**
 * Before the interview: a greeting and Begin. Seated / standing, recenter,
 * captions and the how-to only appear in the headset, where they mean something.
 */
export function MenuPanel({ name, posture, onPosture, onRecenter, onHowTo, captionsOn, onCaptions, onBegin, onQuick, error, inXR, reducedMotion, ...props }) {
  const height = inXR ? 0.53 : 0.34
  const left = -WIDTH / 2 + space.xl
  const top = height / 2 - space.xl
  const inner = WIDTH - space.xl * 2
  const bottom = -height / 2 + space.xl

  return (
    <group {...props}>
      <Card width={WIDTH} height={height}>
        <Logo size={0.06} position={[left + 0.03, top - 0.03, 0.001]} />
        <Label variant="title2" anchorX="left" anchorY="top" position={[left + 0.08, top - 0.004, 0]}>
          {name ? `Hi ${name}` : 'Interview practice'}
        </Label>
        {/* why the last Begin did not start (mic, connection); otherwise the invitation */}
        <Label
          variant={error ? 'footnote' : 'subhead'}
          tone={error ? 'negative' : 'text2'}
          anchorX="left"
          anchorY="top"
          maxWidth={inner - 0.08}
          position={[left + 0.08, top - 0.05, 0]}
        >
          {error ?? 'Begin when you are ready.'}
        </Label>

        {inXR && (
          <group position={[left, top - 0.13, 0.003]}>
            <Segment label="Seated" selected={posture === 'seated'} onPress={() => onPosture('seated')} x={0.065} reducedMotion={reducedMotion} />
            <Segment label="Standing" selected={posture === 'standing'} onPress={() => onPosture('standing')} x={0.21} reducedMotion={reducedMotion} />
            <RaisedButton label="Recenter" tone="secondary" variant="subhead" width={0.14} height={0.056} onPress={onRecenter} reducedMotion={reducedMotion} position={[inner - 0.07, 0, 0]} />
            {/* opt-in: off, nothing sits under the interviewer */}
            <RaisedButton
              label={captionsOn ? 'Captions on' : 'Captions off'}
              tone={captionsOn ? 'action' : 'chip'}
              variant="subhead"
              width={0.2}
              height={0.056}
              radius={0.028}
              onPress={onCaptions}
              reducedMotion={reducedMotion}
              position={[0.1, -0.072, 0]}
            />
          </group>
        )}

        {/* the one-minute option sits beside Begin as the quieter key */}
        <group position={[0, bottom + (inXR ? 0.1 : 0.05), 0.003]}>
          <RaisedButton label="Quick · 1 min" tone="secondary" variant="subhead" width={inner * 0.36} onPress={onQuick} reducedMotion={reducedMotion} position={[-inner / 2 + inner * 0.18, 0, 0]} />
          <RaisedButton label="Begin" width={inner * 0.6} onPress={onBegin} reducedMotion={reducedMotion} position={[inner / 2 - inner * 0.3, 0, 0]} />
        </group>
        {inXR ? (
          <TextLink label="How it works" onPress={onHowTo} reducedMotion={reducedMotion} position={[0, bottom + 0.02, 0.003]} />
        ) : (
          <Label variant="footnote" tone="text2" anchorX="center" anchorY="top" position={[0, bottom - 0.004, 0]}>
            Enter begins, Q is the one-minute version. Esc ends it.
          </Label>
        )}
      </Card>
    </group>
  )
}

function Segment({ label, selected, onPress, x, reducedMotion }) {
  return (
    <RaisedButton
      label={label}
      tone={selected ? 'action' : 'chip'}
      variant="subhead"
      width={0.13}
      height={0.056}
      radius={0.028}
      onPress={onPress}
      reducedMotion={reducedMotion}
      position={[x, 0, 0]}
    />
  )
}
