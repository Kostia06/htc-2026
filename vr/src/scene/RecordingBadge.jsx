import { C, Label, Panel, PulseDot } from './Panels.jsx'

// A small "Recording" pill while the call is recorded for the replay, so the candidate knows it is.
export function RecordingBadge({ position, rotation, reducedMotion }) {
  return (
    <group position={position} rotation={rotation}>
      <Panel width={0.13} height={0.036} radius={0.018}>
        <PulseDot color={C.red} position={[-0.042, 0, 0.001]} reducedMotion={reducedMotion} />
        <Label size={0.0145} anchorX="left" anchorY="middle" position={[-0.026, 0.001, 0.001]}>
          Recording
        </Label>
      </Panel>
    </group>
  )
}
