import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useXR, useXRInputSourceState } from '@react-three/xr'
import * as THREE from 'three'
import { HEIGHT_RANGE, heightFor, isPlausibleEyeHeight, panelLift, recenterTransform } from './comfort.js'
import { INTERVIEWER_EYE_Y } from './seating.js'

// Where the XR origin sits: height for the candidate's posture, and the
// recenter transform. Seat height varies by half a metre between a couch, an
// office chair and standing, and `local-floor` reports the real floor, so the
// scene cannot guess; it measures once the pose settles, and the candidate can
// nudge it with the thumbstick (click the stick to re-level).

const HEIGHT_KEY = 'aim.heightOffset'
const POSTURE_KEY = 'skillit.vr.posture'

function read(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // storage blocked: the setting lasts for this visit only
  }
}

export function useComfort(inXR) {
  const [posture, setPostureState] = useState(() => (read(POSTURE_KEY, 'seated') === 'standing' ? 'standing' : 'seated'))
  const [offset, setOffset] = useState(() => {
    const saved = Number(read(HEIGHT_KEY, '0'))
    return Number.isFinite(saved) ? saved : 0
  })
  const [origin, setOrigin] = useState({ x: 0, z: 0, rotationY: 0 })
  const [eye, setEye] = useState(0)

  const referenceSpace = useXR((state) => state.originReferenceSpace)
  const left = useXRInputSourceState('controller', 'left')
  const right = useXRInputSourceState('controller', 'right')

  const current = useRef(offset)
  const postureRef = useRef(posture)
  postureRef.current = posture
  const request = useRef(null) // 'level' | 'recenter' — needs a frame, so queued
  const settleFor = useRef(0)
  const settled = useRef(false)
  const stickWasDown = useRef(false)
  const saveAt = useRef(0)

  const applyHeight = (next) => {
    current.current = THREE.MathUtils.clamp(next, HEIGHT_RANGE[0], HEIGHT_RANGE[1])
    setOffset(current.current)
    write(HEIGHT_KEY, current.current)
  }

  useEffect(() => {
    if (!inXR) settled.current = false
  }, [inXR])

  useFrame((_, delta, frame) => {
    const pose = frame && referenceSpace ? frame.getViewerPose(referenceSpace) : null
    const head = pose?.transform

    // The first instant of a session reports garbage; level once it settles.
    if (inXR && !settled.current) {
      settleFor.current += delta
      if (settleFor.current > 0.8 && head && isPlausibleEyeHeight(head.position.y)) {
        settled.current = true
        settleFor.current = 0
        request.current = request.current ?? 'level'
      }
    }

    if (request.current && head && isPlausibleEyeHeight(head.position.y)) {
      setEye(head.position.y)
      applyHeight(heightFor(postureRef.current, head.position.y, INTERVIEWER_EYE_Y))
      if (request.current === 'recenter') setOrigin(recenterTransform(head.position, head.orientation))
      request.current = null
    }

    const stick = right?.gamepad?.['xr-standard-thumbstick'] ?? left?.gamepad?.['xr-standard-thumbstick']
    const down = stick?.state === 'pressed'
    if (down && !stickWasDown.current) request.current = 'level'
    stickWasDown.current = down

    const y = stick?.yAxis ?? 0
    if (Math.abs(y) < 0.2) return // deadzone, or drift creeps the view every frame
    current.current = THREE.MathUtils.clamp(current.current - y * delta * 0.4, HEIGHT_RANGE[0], HEIGHT_RANGE[1])
    setOffset(current.current)
    saveAt.current += delta
    if (saveAt.current > 0.5) {
      saveAt.current = 0
      write(HEIGHT_KEY, current.current)
    }
  })

  return {
    posture,
    setPosture: (next) => {
      setPostureState(next)
      postureRef.current = next
      write(POSTURE_KEY, next)
      request.current = 'level'
    },
    recenter: () => {
      request.current = 'recenter'
    },
    origin: { position: [origin.x, offset, origin.z], rotationY: origin.rotationY },
    lift: panelLift(posture, eye, INTERVIEWER_EYE_Y),
  }
}
