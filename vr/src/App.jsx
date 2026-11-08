import { useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Preload } from '@react-three/drei'
import { XR, createXRStore } from '@react-three/xr'
import * as THREE from 'three'
import { Scene } from './scene/Scene.jsx'
import { INTERVIEWER_EYE_Y, INTERVIEWER_Z } from './scene/seating.js'
import { Overlay } from './ui/Overlay.jsx'
import { useInterview } from './interview/useInterview.js'
import { enterImmersive } from './interview/microphone.js'
import { useHeadsetSession } from './headset/useHeadsetSession.js'
import { useLaunchPolling } from './headset/useLaunchPolling.js'
import { color } from './theme/tokens.js'
import { useInterviewReview } from './review/useInterviewReview.js'
import { useCaptions } from './ui/useCaptions.js'

export default function App() {
  // Controllers, hands and their rays are the store's defaults, which mount only
  // for input sources of a live XR session: the desktop view never shows them.
  //
  // offerSession off: by default the store offers the Quest Browser an
  // immersive-ar (passthrough) session, which the browser's own button starts.
  // The office is a full VR room, and only our Enter VR press asks for the
  // microphone in 2D first, so that press is the only way in.
  const store = useMemo(() => createXRStore({ foveation: 0.6, emulate: false, offerSession: false }), [])
  const headset = useHeadsetSession()
  const interview = useInterview({
    token: headset.token,
    onSignedOut: headset.signOut,
    isImmersive: () => store.getState().session != null,
  })
  const vrSupported = useVRSupport()
  const review = useInterviewReview(interview, headset)
  const captions = useCaptions()

  // "Practice in VR" on the phone queues a launch; pick it up while the room is
  // idle and start that interview. Paused during one so a second tap cannot
  // restart it. A launch naming a past session opens its review instead.
  useLaunchPolling(headset.session, {
    enabled: headset.phase === 'signedIn' && interview.phase === 'idle',
    onLaunch: (launch) => {
      if (!launch.reviewSessionId) return interview.actions.begin(launch)
      review.open(launch.reviewSessionId)
      return true
    },
    onSignedOut: headset.signOut,
  })

  // Devtools on a Quest are awkward; this makes the state machine pokeable from
  // chrome://inspect while wearing the headset.
  useEffect(() => {
    if (import.meta.env.DEV) {
      window.__interview = interview
      window.__headset = headset
      window.__review = review
    }
  })

  return (
    <>
      <Canvas
        shadows="percentage"
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        // the candidate's seat, eyes level with the interviewer's
        camera={{ position: [0, INTERVIEWER_EYE_Y, 0.1], fov: 62, near: 0.05, far: 60 }}
        onCreated={({ gl, scene }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.05
          scene.background = new THREE.Color(color.ground)
          if (import.meta.env.DEV) Object.assign(window, { __gl: gl, __scene: scene }) // draw-call counts from devtools
        }}
      >
        <XR store={store}>
          <QuestAutoEnter store={store} />
          <Scene interview={interview} headset={headset} review={review} captions={captions} />
          <Preload all />
        </XR>
        {/* Desktop preview only: inside XR the headset drives the camera and
            these controls are inert. */}
        <OrbitControls
          // his face, a little below the eyes so his hands on the table stay in frame
          target={[0, INTERVIEWER_EYE_Y - 0.1, INTERVIEWER_Z]}
          enablePan={false}
          minDistance={0.4}
          maxDistance={2.4}
          maxPolarAngle={Math.PI / 1.9}
          enableDamping
          dampingFactor={0.08}
        />
      </Canvas>

      <Overlay
        interview={interview}
        headset={headset}
        vrSupported={vrSupported}
        captions={captions}
        onEnterVR={() => enterImmersive(() => store.enterVR())}
      />
    </>
  )
}

function useVRSupport() {
  const [supported, setSupported] = useState(false)
  useEffect(() => {
    let cancelled = false
    navigator.xr
      ?.isSessionSupported('immersive-vr')
      .then((ok) => !cancelled && setSupported(ok))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  return supported
}

// The Quest app opens this page as an immersive app (?app=quest), which shows only passthrough
// unless the page enters VR itself. It runs inside <XR>, so the renderer is already bound to the
// store and the first VR frame draws the office. The microphone is asked for first, while the
// page is still flat: the same prompt inside VR would end the session.
function QuestAutoEnter({ store }) {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('app') !== 'quest') return
    const timer = setTimeout(() => {
      enterImmersive(() => store.enterVR())
    }, 300)
    return () => clearTimeout(timer)
  }, [store])
  return null
}
