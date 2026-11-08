import { useState } from 'react'
import { XROrigin, useXR } from '@react-three/xr'
import { Room } from './Room.jsx'
import { Interviewer } from './Interviewer.jsx'
import { ActionButton, ReviewPanel } from './Panels.jsx'
import { PairingPanel } from './PairingPanel.jsx'
import { Veil, useFadeSwap } from './Fade.jsx'
import { MenuPanel } from './ui/MenuPanel.jsx'
import { Caption } from './ui/Caption.jsx'
import { HintCard } from './ui/HintCard.jsx'
import { RecordingBadge } from './RecordingBadge.jsx'
import { ReviewMoments } from './ReviewMoments.jsx'
import { useHints } from '../ui/useHints.js'
import { useComfort } from './useComfort.js'
import { useSpatialVoice } from './useSpatialVoice.js'
import { useControllerInput, useGreeting, useKeyboard, useRecent } from './useSceneInput.js'
import { useReducedMotion } from '../ui/useReducedMotion.js'
import { INTERVIEWER_EYE_Y, INTERVIEWER_Z } from './seating.js'
import { toPanelScore, toPanelSummary } from '../interview/scores.js'

// Laid out for a candidate sitting at the near edge of the desk, looking down -Z.
// Panels float 1.0-1.2 m out, just below eye level (comfortable focus, readable
// type), beside the interviewer so his face stays clear. These are the values
// you actually tune while wearing the headset.
//
// During the interview the room is kept as close to a real one as possible:
// no status text, no spinners, nothing over or under the interviewer. Only the
// desk button (answer / done), the score card beside him after an answer, and
// captions below him if the candidate turned them on in the menu.
const INTERVIEWER = { position: [0, 0, INTERVIEWER_Z], rotation: [0, 0, 0] }
const MOUTH = [0, INTERVIEWER_EYE_Y - 0.08, INTERVIEWER_Z + 0.08]
const PAIRING_PANEL = { position: [0, 1.18, -1.1], rotation: [-0.14, 0, 0] }
// below his face, so the candidate already meets his eyes on the menu
const MENU_PANEL = { position: [0, 1.04, -1.1], rotation: [-0.3, 0, 0] }
// Upright and level, clear of the menu and summary in the middle and well above the desk (top 0.745).
const SIDE_PANEL = { position: [-0.68, 1.2, -0.95], rotation: [0, 0.55, 0] }
const SUMMARY_PANEL = { position: [0, 1.14, -1.12], rotation: [-0.14, 0, 0] }
const CAPTION = { position: [0, 0.9, -1.15], rotation: [-0.35, 0, 0] }
const BUTTON = { position: [0, 0.88, -0.58], rotation: [-0.8, 0, 0] }
// the replay sits opposite the score card, on the right
const REVIEW_MOMENTS = { position: [0.68, 1.2, -0.95], rotation: [0, -0.55, 0] }
// lying on the desk beside the answer key
const RECORDING_BADGE = { position: [0.25, 0.87, -0.6], rotation: [-0.8, 0, 0] }
const GREETING_MS = 1800
const REVIEW_VISIBLE_MS = 6000

function stageOf({ showPairing, phase }) {
  if (showPairing) return 'pairing'
  if (phase === 'idle') return 'menu'
  if (phase === 'done') return 'summary'
  return 'interview'
}

// `headset` comes from useHeadsetSession: { phase, profile, signedInAt, claim }.
// Until it is signedIn the scene shows the keypad instead of the menu, unless the
// candidate chose to carry on with example data.
// `review` (useInterviewReview) is the replay of a finished or phone-chosen
// session, shown beside the summary or the menu; never during an interview.
export function Scene({ interview, headset, review, captions }) {
  const { phase, meta, result, resultAt, summary, transcript, caption, error, speaking, speechMs, micDenied, getAmplitude, actions, isStub, recording } = interview
  const reducedMotion = useReducedMotion()
  const inXR = useXR((state) => state.session != null)
  const comfort = useComfort(inXR)
  const hints = useHints('headset')
  useSpatialVoice(MOUTH)

  const signedIn = headset?.phase === 'signedIn'
  const [skippedSignIn, setSkippedSignIn] = useState(false)
  const greeting = useGreeting(headset?.signedInAt, GREETING_MS)
  const showPairing = Boolean(headset) && ((!signedIn && !skippedSignIn) || (signedIn && greeting))

  // Keypad, menu, interview and summary swap in the dark, never as a hard cut.
  const stage = useFadeSwap(stageOf({ showPairing, phase }))

  // Trigger-anywhere belongs to the interview only: on the menu and summary the
  // trigger is for pressing what the ray points at. The keypad owns all input.
  useControllerInput(interview, stage === 'interview', !showPairing)
  useKeyboard(interview, !showPairing)

  // The spec is explicit: the score shows for about six seconds after an answer
  // and never while one is being given. Reading feedback mid-answer is the single
  // easiest way to put the candidate off.
  const showReview = useRecent(resultAt, REVIEW_VISIBLE_MS) && phase !== 'listening'

  const buttonProps = buttonFor(phase, actions, { micDenied })

  return (
    <>
      {/* local-floor: the candidate's real chair sets eye height; the origin
          only moves when they ask (posture, recenter, thumbstick). */}
      <XROrigin position={comfort.origin.position} rotation-y={comfort.origin.rotationY} />
      <Veil />

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

      <group position-y={comfort.lift}>
        {stage === 'pairing' && headset && (
          <PairingPanel
            status={signedIn ? 'signedIn' : headset.phase === 'signedOut' ? 'keypad' : headset.phase}
            claim={headset.claim}
            greeting={`Hi ${headset.profile?.name ?? 'there'}`}
            onSkip={() => setSkippedSignIn(true)}
            reducedMotion={reducedMotion}
            position={PAIRING_PANEL.position}
            rotation={PAIRING_PANEL.rotation}
          />
        )}

        {stage === 'menu' && (
          <>
            <MenuPanel
              name={signedIn ? headset?.profile?.name : null}
              posture={comfort.posture}
              onPosture={comfort.setPosture}
              onRecenter={comfort.recenter}
              onHowTo={hints.show}
              captionsOn={Boolean(captions?.on)}
              onCaptions={captions?.toggle}
              onBegin={() => actions.begin()}
              onQuick={actions.beginQuick}
              inXR={inXR}
              reducedMotion={reducedMotion}
              position={MENU_PANEL.position}
              rotation={MENU_PANEL.rotation}
            />
            {/* first visit only; once dismissed it stays gone (menu reopens it) */}
            {inXR && hints.open && (
              <HintCard onClose={hints.close} reducedMotion={reducedMotion} position={SIDE_PANEL.position} rotation={SIDE_PANEL.rotation} />
            )}
          </>
        )}

        {stage === 'interview' && (
          <>
            {inXR && captions?.on && (
              <Caption
                text={error ?? (phase === 'listening' ? transcript : caption)}
                tone={error ? 'negative' : 'text'}
                position={CAPTION.position}
                rotation={CAPTION.rotation}
              />
            )}
            {showReview && result && (
              <ReviewPanel
                result={toPanelScore(result)}
                sample={isStub}
                position={SIDE_PANEL.position}
                rotation={SIDE_PANEL.rotation}
                reducedMotion={reducedMotion}
              />
            )}
            {buttonProps && (
              <ActionButton {...buttonProps} position={BUTTON.position} rotation={BUTTON.rotation} reducedMotion={reducedMotion} />
            )}
            {/* consent, not chatter: the candidate must know the call is recorded */}
            {recording && <RecordingBadge position={RECORDING_BADGE.position} rotation={RECORDING_BADGE.rotation} />}
          </>
        )}

        {stage === 'summary' && summary && (
          <ReviewPanel
            summary={toPanelSummary(summary)}
            meta={meta}
            sample={isStub}
            onPracticeAgain={actions.restart}
            position={SUMMARY_PANEL.position}
            rotation={SUMMARY_PANEL.rotation}
            reducedMotion={reducedMotion}
          />
        )}

        {/* after an interview, or a past one opened from the phone */}
        {(stage === 'summary' || stage === 'menu') && review?.sessionId && (
          <ReviewMoments review={review} position={REVIEW_MOMENTS.position} rotation={REVIEW_MOMENTS.rotation} reducedMotion={reducedMotion} />
        )}
      </group>
    </>
  )
}

// Only the two moments the candidate has to act: start answering, and say
// they are done. While he talks or while scoring, nothing is shown at all.
function buttonFor(phase, actions, { micDenied } = {}) {
  switch (phase) {
    case 'awaiting':
      return {
        label: 'Answer',
        // the one hint worth showing: without a mic, talking does nothing
        hint: micDenied ? 'Microphone blocked, press to answer' : null,
        onClick: actions.startAnswer,
      }
    case 'listening':
      return { label: 'Done', onClick: actions.stopAnswer, tone: 'red' }
    default:
      return null
  }
}
