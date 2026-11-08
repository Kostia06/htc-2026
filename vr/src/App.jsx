import { useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Preload } from '@react-three/drei'
import { XR, createXRStore } from '@react-three/xr'
import * as THREE from 'three'
import { Scene } from './scene/Scene.jsx'
import { INTERVIEWER_EYE_Y, INTERVIEWER_Z } from './scene/seating.js'
import { Overlay } from './ui/Overlay.jsx'
import { useInterview } from './interview/useInterview.js'

export default function App() {
  const store = useMemo(() => createXRStore({ foveation: 0.6, emulate: false }), [])
  const interview = useInterview()
  const vrSupported = useVRSupport()

  // Devtools on a Quest are awkward; this makes the state machine pokeable from
  // chrome://inspect while wearing the headset.
  useEffect(() => {
    if (import.meta.env.DEV) window.__interview = interview
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
          scene.background = new THREE.Color('#0b0e14')
        }}
      >
        <XR store={store}>
          <Scene interview={interview} />
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
        vrSupported={vrSupported}
        onEnterVR={() => store.enterVR()}
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
