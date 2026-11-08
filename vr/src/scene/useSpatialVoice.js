import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { forgetClosed, setListenerPose, setVoicePosition } from '../interview/spatialAudio.js'

/**
 * Keeps the Web Audio listener on the candidate's head and the interviewer's
 * voice at his mouth. In XR, three updates the default camera from the
 * headset pose every frame, so reading it here is the head.
 */
export function useSpatialVoice(mouth) {
  const camera = useThree((s) => s.camera)
  const scratch = useMemo(() => ({ pos: new THREE.Vector3(), fwd: new THREE.Vector3(), up: new THREE.Vector3(), q: new THREE.Quaternion() }), [])

  useEffect(() => {
    setVoicePosition(mouth[0], mouth[1], mouth[2])
    const timer = setInterval(forgetClosed, 10000)
    return () => clearInterval(timer)
  }, [mouth[0], mouth[1], mouth[2]])

  useFrame(() => {
    camera.getWorldPosition(scratch.pos)
    camera.getWorldQuaternion(scratch.q)
    scratch.fwd.set(0, 0, -1).applyQuaternion(scratch.q)
    scratch.up.set(0, 1, 0).applyQuaternion(scratch.q)
    setListenerPose(scratch.pos, scratch.fwd, scratch.up)
  })
}
