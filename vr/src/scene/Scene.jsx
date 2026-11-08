import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { XROrigin, useXR, useXRInputSourceState } from '@react-three/xr'
import { Room } from './Room.jsx'
import { Interviewer } from './Interviewer.jsx'
import { ActionButton, Captions, QuestionPanel, ReviewPanel } from './Panels.jsx'
import { useReducedMotion } from '../ui/useReducedMotion.js'
import { INTERVIEWER_EYE_Y, INTERVIEWER_Z } from './seating.js'

// Laid out for a candidate sitting at the near edge of the desk, looking down -Z.
// These are the values you actually tune while wearing the headset.
const INTERVIEWER = { position: [0, 0, INTERVIEWER_Z], rotation: [0, 0, 0] }
const QUESTION_PANEL = { position: [0.54, 1.2, -1.02], rotation: [-0.1, -0.45, 0] }
const REVIEW_PANEL = { position: [-0.56, 1.22, -0.98], rotation: [-0.1, 0.47, 0] }
const BUTTON = { position: [0, 0.9, -0.56], rotation: [-0.8, 0, 0] }
const CAPTIONS = { position: [0, 0.94, -1.16], rotation: [-0.22, 0, 0] }

const REVIEW_VISIBLE_MS = 6000

// Seat height varies by metres between a couch, an office chair and standing,
// and `local-floor` reports the real floor, so the scene cannot guess. Let the
// candidate dial it in with the thumbstick and remember it.
const HEIGHT_KEY = 'aim.heightOffset'
const HEIGHT_RANGE = [-0.8, 1.0]

function useHeightOffset(inXR) {
  const [offset, setOffset] = useState(() => {
    const saved = Number(localStorage.getItem(HEIGHT_KEY))
    return Number.isFinite(saved) ? saved : 0
  })
  const referenceSpace = useXR((state) => state.originReferenceSpace)
  const left = useXRInputSourceState('controller', 'left')
  const right = useXRInputSourceState('controller', 'right')

  const current = useRef(offset)
  const saveAt = useRef(0)
  const settleFor = useRef(0)
  const calibrated = useRef(false)
  const stickWasDown = useRef(false)
  const measured = useRef(0)

  const apply = (next) => {
    const clamped = THREE.MathUtils.clamp(next, HEIGHT_RANGE[0], HEIGHT_RANGE[1])
    current.current = clamped
    setOffset(clamped)
    localStorage.setItem(HEIGHT_KEY, String(clamped))
  }

  // Put the candidate's eyes level with the interviewer's, whatever they are
  // sitting on. A couch, an office chair and standing differ by half a metre,
  // and `local-floor` reports the real floor, so this cannot be a fixed number.
  const calibrate = (frame) => {
    if (!frame || !referenceSpace) return false
    const pose = frame.getViewerPose(referenceSpace)
    const realEyeHeight = pose?.transform.position.y
    if (!(realEyeHeight > 0.3 && realEyeHeight < 2.3)) return false // not settled
    measured.current = realEyeHeight
    apply(INTERVIEWER_EYE_Y - realEyeHeight)
    return true
  }

  useEffect(() => {
    if (!inXR) calibrated.current = false
  }, [inXR])

  useFrame((_, delta, frame) => {
    // Headset pose is garbage for the first instant of a session; wait for it.
    if (inXR && !calibrated.current) {
      settleFor.current += delta
      if (settleFor.current > 0.8 && calibrate(frame)) {
        calibrated.current = true
        settleFor.current = 0
      }
    }

    const stick =
      right?.gamepad?.['xr-standard-thumbstick'] ?? left?.gamepad?.['xr-standard-thumbstick']

    // Click the stick to re-level at any time — useful if you shift in your seat.
    const down = stick?.state === 'pressed'
    if (down && !stickWasDown.current) calibrate(frame)
    stickWasDown.current = down

    const y = stick?.yAxis ?? 0
    if (Math.abs(y) < 0.2) return // deadzone, or drift creeps the view every frame

    current.current = THREE.MathUtils.clamp(
      current.current - y * delta * 0.4,
      HEIGHT_RANGE[0],
      HEIGHT_RANGE[1],
    )
    setOffset(current.current)
    saveAt.current += delta
    if (saveAt.current > 0.5) {
      saveAt.current = 0
      localStorage.setItem(HEIGHT_KEY, String(current.current))
    }
  })

  return { offset, measured: measured.current, calibrated: calibrated.current }
}

export function Scene({ interview }) {
  const { phase, question, meta, result, summary, transcript, caption, error, speaking, speechMs, getAmplitude, actions, isStub } = interview
  const reducedMotion = useReducedMotion()
  const inXR = useXR((state) => state.session != null)
  const { offset: heightOffset, measured, calibrated } = useHeightOffset(inXR)

  useControllerInput(interview)
  useKeyboard(interview)

  // The spec is explicit: the score shows for about six seconds after an answer
  // and never while one is being given. Reading feedback mid-answer is the single
  // easiest way to put the candidate off.
  const showReview = useTimedVisibility(phase === 'review', REVIEW_VISIBLE_MS) && phase !== 'listening'

  const buttonProps = buttonFor(phase, actions)

  return (
    <>
      {/* local-floor: the candidate's real chair sets eye height, so the scene
          does not have to guess it. */}
      <XROrigin position={[0, heightOffset, 0]} />

      <Room />

      <Interviewer
        position={INTERVIEWER.position}
        rotation={INTERVIEWER.rotation}
        speaking={speaking}
        speechText={caption}
        speechMs={speechMs}
        listening={phase === 'listening'}
        getAmplitude={getAmplitude}
        reducedMotion={reducedMotion}
      />

      {inXR && (
        <Captions
          text={phase === 'listening' ? transcript : caption}
          speaker={phase === 'listening' ? 'You' : 'Interviewer'}
          position={CAPTIONS.position}
          rotation={CAPTIONS.rotation}
        />
      )}

      <QuestionPanel
        phase={phase}
        question={question}
        meta={meta}
        transcript={transcript}
        error={error}
        position={QUESTION_PANEL.position}
        rotation={QUESTION_PANEL.rotation}
        reducedMotion={reducedMotion}
      />

      {(showReview || phase === 'done') && (
        <ReviewPanel
          result={phase === 'done' ? null : result}
          summary={phase === 'done' ? summary : null}
          sample={isStub}
          position={REVIEW_PANEL.position}
          rotation={REVIEW_PANEL.rotation}
          reducedMotion={reducedMotion}
        />
      )}

      {buttonProps && (
        <ActionButton
          {...buttonProps}
          position={BUTTON.position}
          rotation={BUTTON.rotation}
          reducedMotion={reducedMotion}
        />
      )}
    </>
  )
}

function buttonFor(phase, actions) {
  switch (phase) {
    case 'idle':
      return { label: 'Begin', hint: 'Pull the trigger or press A', onClick: actions.begin }
    case 'asking':
      return { label: 'Listen', disabled: true, busy: true, onClick: () => {} }
    case 'awaiting':
      return { label: 'Answer', hint: 'Hold the trigger or Space while you talk', onClick: actions.startAnswer }
    case 'listening':
      return { label: 'Done', hint: 'Let go when you finish', onClick: actions.stopAnswer, tone: 'red' }
    case 'scoring':
      return { label: 'Scoring', disabled: true, busy: true, onClick: () => {} }
    case 'review':
      return { label: 'Next question', hint: 'Trigger or A', onClick: actions.ask }
    case 'done':
      return { label: 'Practice again', hint: 'Trigger or A', onClick: actions.restart, tone: 'green' }
    default:
      return null
  }
}

// Shows `active`, then keeps showing it for `ms` after it goes false.
function useTimedVisibility(active, ms) {
  const [visible, setVisible] = useState(active)

  useEffect(() => {
    if (!active) return undefined
    setVisible(true)
    const timer = setTimeout(() => setVisible(false), ms)
    return () => clearTimeout(timer)
  }, [active, ms])

  return active || visible
}

// Trigger or A advances; hold either to answer. B ends the interview. Polled
// rather than event-subscribed so a missed event can never leave the mic open.
function useControllerInput({ phase, actions }) {
  const right = useXRInputSourceState('controller', 'right')
  const left = useXRInputSourceState('controller', 'left')
  const wasAdvanceDown = useRef(false)
  const wasEndDown = useRef(false)
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  useFrame(() => {
    const source = right ?? left
    const pad = source?.gamepad
    if (!pad) return

    const advance =
      pad['xr-standard-trigger']?.state === 'pressed' || pad['a-button']?.state === 'pressed'
    const end = pad['b-button']?.state === 'pressed'

    if (end !== wasEndDown.current) {
      wasEndDown.current = end
      if (end) {
        actions.restart()
        return
      }
    }

    if (advance === wasAdvanceDown.current) return
    wasAdvanceDown.current = advance

    const current = phaseRef.current
    if (advance) {
      if (current === 'idle') actions.begin()
      else if (current === 'awaiting') actions.startAnswer()
      else if (current === 'review') actions.ask()
      else if (current === 'done') actions.restart()
    } else if (current === 'listening') {
      actions.stopAnswer()
    }
  })
}

// Desktop parity, and the keyboard half of the accessibility requirement.
function useKeyboard({ actions }) {
  const actionsRef = useRef(actions)
  actionsRef.current = actions

  useEffect(() => {
    const onDown = (e) => {
      if (e.repeat) return
      const a = actionsRef.current
      if (e.code === 'Space') {
        e.preventDefault()
        a.startAnswer()
        return
      }
      if (e.code === 'Enter') {
        a.advance()
      }
      if (e.code === 'KeyM') a.toggleMute()
      if (e.code === 'Escape') a.restart()
    }
    const onUp = (e) => {
      if (e.code === 'Space') {
        e.preventDefault()
        actionsRef.current.stopAnswer()
      }
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [])
}
