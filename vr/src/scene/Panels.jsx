import { RoundedBox, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'

export const FONT = '/fonts/Inter-Regular.woff'
export const FONT_BOLD = '/fonts/Inter-SemiBold.woff'

export const INK = '#f4f6fa'
export const MUTED = '#9aa6b8'
export const GOOD = '#7fd4a8'
export const PANEL_BG = '#111620'

const DIMENSIONS = ['structure', 'clarity', 'confidence', 'relevance']

// Sizes are metres. At the ~1.1 m reading distance in this scene, body text below
// about 0.02 m stops being legible through the Quest's lenses.
export function Panel({ width, height, children, ...props }) {
  return (
    <group {...props}>
      <RoundedBox args={[width, height, 0.012]} radius={0.016} smoothness={3}>
        <meshStandardMaterial color={PANEL_BG} roughness={0.5} transparent opacity={0.94} />
      </RoundedBox>
      <group position={[0, 0, 0.008]}>{children}</group>
    </group>
  )
}

export function QuestionPanel({ phase, question, meta, transcript, error, position, rotation }) {
  const width = 0.62
  const height = 0.4

  const status = {
    asking: 'Interviewer is speaking',
    awaiting: 'Your turn',
    listening: 'Listening…',
    scoring: 'Scoring your answer',
    review: 'Feedback',
    done: 'Interview complete',
  }[phase]

  return (
    <Panel width={width} height={height} position={position} rotation={rotation}>
      <Text
        font={FONT_BOLD}
        fontSize={0.019}
        color={MUTED}
        maxWidth={width - 0.1}
        anchorX="left"
        anchorY="top"
        position={[-width / 2 + 0.045, height / 2 - 0.036, 0]}
        letterSpacing={0.08}
      >
        {(meta ? `${meta.company} · ${meta.role}` : 'AI MENTOR').toUpperCase()}
      </Text>

      {question?.isSeeded && (
        <Badge label="EXAMPLE" position={[width / 2 - 0.095, -height / 2 + 0.034, 0]} />
      )}

      <Text
        font={FONT}
        fontSize={0.034}
        lineHeight={1.36}
        color={error ? '#f08f7a' : INK}
        maxWidth={width - 0.09}
        anchorX="left"
        anchorY="top"
        position={[-width / 2 + 0.045, height / 2 - 0.072, 0]}
      >
        {error ?? question?.text ?? 'Sit down, put the headset on, and press Begin when you are ready.'}
      </Text>

      {phase === 'listening' && transcript && (
        <Text
          font={FONT}
          fontSize={0.022}
          lineHeight={1.3}
          color={MUTED}
          maxWidth={width - 0.09}
          anchorX="left"
          anchorY="bottom"
          position={[-width / 2 + 0.045, -height / 2 + 0.066, 0]}
        >
          {transcript.length > 160 ? `…${transcript.slice(-160)}` : transcript}
        </Text>
      )}

      <Text
        font={FONT_BOLD}
        fontSize={0.018}
        color={phase === 'listening' ? GOOD : MUTED}
        anchorX="left"
        anchorY="bottom"
        position={[-width / 2 + 0.045, -height / 2 + 0.028, 0]}
        letterSpacing={0.06}
      >
        {(status ?? '').toUpperCase()}
      </Text>
    </Panel>
  )
}

// Renders an AnswerScore (four 1-5 dimensions, pace, filler words, coaching) or
// the end-of-interview aggregate.
export function ReviewPanel({ result, summary, position, rotation }) {
  const width = 0.6
  const height = 0.54
  if (!result && !summary) return null

  // The live voice API scores a slightly different four; a result may say which.
  const dimensions = result?.dimensions ?? DIMENSIONS
  const overall = result ? mean(dimensions.map((d) => result[d] ?? 0)) : (summary?.overall ?? 0)
  const half = height / 2

  return (
    <Panel width={width} height={height} position={position} rotation={rotation}>
      <Text font={FONT_BOLD} fontSize={0.018} color={MUTED} anchorX="left" anchorY="top"
        position={[-width / 2 + 0.045, half - 0.03, 0]} letterSpacing={0.08}>
        {summary ? 'OVERALL' : 'THIS ANSWER'}
      </Text>

      <Text font={FONT_BOLD} fontSize={0.075} color={scoreColor(overall)} anchorX="left" anchorY="top"
        position={[-width / 2 + 0.045, half - 0.056, 0]}>
        {overall.toFixed(1)}
      </Text>
      <Text font={FONT} fontSize={0.02} color={MUTED} anchorX="left" anchorY="top"
        position={[-width / 2 + 0.165, half - 0.098, 0]}>
        / 5
      </Text>

      {result && (
        <group position={[width / 2 - 0.215, half - 0.045, 0]}>
          {dimensions.map((dim, i) => (
            <Meter key={dim} label={dim} value={result[dim] ?? 0} position={[0, -i * 0.05, 0]} />
          ))}
        </group>
      )}

      {result && (
        <Text font={FONT} fontSize={0.017} color={MUTED} anchorX="left" anchorY="top"
          position={[-width / 2 + 0.045, half - 0.135, 0]}>
          {`${result.wpm ?? 0} wpm · ${result.fillerWords ?? 0} filler words`}
        </Text>
      )}

      <Text font={FONT} fontSize={0.023} lineHeight={1.34} color={INK} maxWidth={width - 0.09}
        anchorX="left" anchorY="top" position={[-width / 2 + 0.045, half - 0.172, 0]}>
        {result?.tip ?? summary?.summary ?? ''}
      </Text>

      {result?.strongerAnswer && (
        <>
          <Text font={FONT_BOLD} fontSize={0.017} color={GOOD} anchorX="left" anchorY="top"
            position={[-width / 2 + 0.045, -0.025, 0]} letterSpacing={0.07}>
            A STRONGER ANSWER
          </Text>
          <Text font={FONT} fontSize={0.021} lineHeight={1.36} color="#d6dde8" maxWidth={width - 0.09}
            anchorX="left" anchorY="top" position={[-width / 2 + 0.045, -0.05, 0]}>
            {result.strongerAnswer}
          </Text>
        </>
      )}
    </Panel>
  )
}

// Captions sit under the interviewer rather than on a panel, so the candidate can
// read without looking away from the face they are supposed to hold eye contact with.
export function Captions({ text, speaker = 'Interviewer', position, rotation }) {
  if (!text) return null
  const width = 0.96
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, -0.004]}>
        <planeGeometry args={[width, 0.14]} />
        <meshBasicMaterial color="#070a10" transparent opacity={0.72} />
      </mesh>
      <Text font={FONT_BOLD} fontSize={0.018} color={MUTED} anchorX="left" anchorY="top"
        position={[-width / 2 + 0.03, 0.05, 0]} letterSpacing={0.06}>
        {speaker.toUpperCase()}
      </Text>
      <Text font={FONT} fontSize={0.026} lineHeight={1.32} color={INK} maxWidth={width - 0.06}
        anchorX="left" anchorY="top" position={[-width / 2 + 0.03, 0.022, 0]}>
        {text}
      </Text>
    </group>
  )
}

function Meter({ label, value, position }) {
  const w = 0.17
  const filled = Math.max(0, Math.min(1, value / 5))
  return (
    <group position={position}>
      <Text font={FONT} fontSize={0.015} color={MUTED} anchorX="left" anchorY="middle" position={[0, 0.016, 0]}>
        {label}
      </Text>
      <Text font={FONT_BOLD} fontSize={0.015} color={scoreColor(value)} anchorX="right" anchorY="middle" position={[w, 0.016, 0]}>
        {String(value)}
      </Text>
      <mesh position={[w / 2, -0.006, 0]}>
        <planeGeometry args={[w, 0.005]} />
        <meshBasicMaterial color="#2a3240" />
      </mesh>
      <mesh position={[(w * filled) / 2, -0.006, 0.001]}>
        <planeGeometry args={[w * filled, 0.005]} />
        <meshBasicMaterial color={scoreColor(value)} toneMapped={false} />
      </mesh>
    </group>
  )
}

function Badge({ label, position }) {
  return (
    <group position={position}>
      <mesh>
        <planeGeometry args={[0.112, 0.03]} />
        <meshBasicMaterial color="#3a3320" />
      </mesh>
      <Text font={FONT_BOLD} fontSize={0.015} color="#e8c974" anchorX="center" anchorY="middle"
        position={[0, 0, 0.001]} letterSpacing={0.09}>
        {label}
      </Text>
    </group>
  )
}

// The one thing the candidate presses. Works with a Quest controller ray, a hand
// pointer and a desktop mouse, because R3F pointer events cover all three.
export function ActionButton({ label, hint, onClick, disabled, position, rotation, accent = '#2f7d5b', reducedMotion }) {
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  const body = useRef()
  const width = 0.32
  const height = 0.1

  useFrame(() => {
    if (!body.current || reducedMotion) return
    const target = disabled ? 1 : pressed ? 0.96 : hovered ? 1.04 : 1
    body.current.scale.x += (target - body.current.scale.x) * 0.25
    body.current.scale.y = body.current.scale.x
  })

  return (
    <group position={position} rotation={rotation}>
      <group
        ref={body}
        onClick={(e) => {
          e.stopPropagation()
          if (!disabled) onClick?.()
        }}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => {
          setHovered(false)
          setPressed(false)
        }}
      >
        <RoundedBox args={[width, height, 0.022]} radius={0.012} smoothness={3}>
          <meshStandardMaterial
            color={disabled ? '#2a2f39' : accent}
            emissive={disabled ? '#000000' : accent}
            emissiveIntensity={hovered ? 0.45 : 0.18}
            roughness={0.45}
          />
        </RoundedBox>
        <Text font={FONT_BOLD} fontSize={0.032} color={disabled ? '#5c6472' : '#ffffff'}
          anchorX="center" anchorY="middle" position={[0, 0, 0.013]}>
          {label}
        </Text>
      </group>
      {hint && (
        <Text font={FONT} fontSize={0.018} color={MUTED} anchorX="center" anchorY="top"
          position={[0, -height / 2 - 0.016, 0]}>
          {hint}
        </Text>
      )}
    </group>
  )
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

function scoreColor(value) {
  if (value >= 4) return '#6ee7a8'
  if (value >= 3) return '#e8c974'
  return '#f08f7a'
}
