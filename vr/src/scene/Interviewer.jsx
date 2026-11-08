import { Component, Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { applyIdle, buildRig, hasMorph, lookAt, setMorph } from './avatarRig.js'
import { ALL_VISEMES, createFaceDriver, textToVisemes } from './lipSync.js'

// Oculus visemes give the best mouth shapes, but most surviving avatar vendors
// (Avaturn, anything ARKit-based) ship only the ARKit set. Rather than fall back
// to jaw-flapping, map each viseme onto the nearest ARKit shapes.
const ARKIT_FALLBACK = {
  viseme_aa: [['jawOpen', 1.0]],
  viseme_E: [['mouthStretchLeft', 0.7], ['mouthStretchRight', 0.7], ['jawOpen', 0.35]],
  viseme_I: [['mouthSmileLeft', 0.5], ['mouthSmileRight', 0.5], ['jawOpen', 0.25]],
  viseme_O: [['mouthFunnel', 0.9], ['jawOpen', 0.45]],
  viseme_U: [['mouthPucker', 0.9], ['jawOpen', 0.2]],
  viseme_PP: [['mouthClose', 0.9]],
  viseme_FF: [['mouthFunnel', 0.35], ['mouthClose', 0.4]],
  viseme_SS: [['mouthStretchLeft', 0.4], ['mouthStretchRight', 0.4]],
  viseme_DD: [['jawOpen', 0.3]],
}
import { Figure } from './Figure.jsx'

const AVATAR_URL = import.meta.env.VITE_AVATAR_URL || '/avatars/interviewer.glb'

const ARKIT_SHAPES = [
  'jawOpen', 'mouthClose', 'mouthFunnel', 'mouthPucker',
  'mouthStretchLeft', 'mouthStretchRight', 'mouthSmileLeft', 'mouthSmileRight',
]

// Ready Player Me rigs are authored standing with their feet on y=0, so the whole
// model drops by roughly a seat height to sit in the chair. That is a property of
// the rig, not of the scene, so callers pass the chair position and this handles it.
const AVATAR_SINK = -0.41

export function Interviewer(props) {
  return (
    <AvatarBoundary fallback={<Figure {...props} />}>
      <Suspense fallback={<Figure {...props} />}>
        <AvatarModel {...props} />
      </Suspense>
    </AvatarBoundary>
  )
}

function AvatarModel({ position = [0, 0, 0], rotation = [0, 0, 0], speaking, speechText, speechMs, listening, getAmplitude, reducedMotion }) {
  const { scene } = useGLTF(AVATAR_URL)
  const camera = useThree((s) => s.camera)
  const face = useMemo(() => createFaceDriver(), [])

  // Clone so hot reload and multiple mounts never share mutated bones.
  const model = useMemo(() => {
    const copy = cloneSkinned(scene)
    copy.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true
        node.receiveShadow = false
      }
    })
    return copy
  }, [scene])

  const rig = useMemo(() => buildRig(model), [model])

  // Decided once per model, not per frame.
  const hasVisemes = useMemo(() => hasMorph(rig.morphMeshes, 'viseme_aa'), [rig])

  useEffect(() => {
    if (import.meta.env.DEV) window.__rig = rig
  }, [rig])

  const gaze = useRef(new THREE.Vector3())
  const time = useRef(0)

  // Drive the mouth from the actual words rather than a generic envelope.
  useEffect(() => {
    if (speaking && speechText && speechMs > 0) {
      face.setScript(textToVisemes(speechText, speechMs))
    } else {
      face.clearScript()
    }
  }, [face, speaking, speechText, speechMs])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30) // a dropped frame must not jolt the pose
    time.current += dt
    const t = time.current

    applyIdle(rig, t, reducedMotion ? 0.25 : 1)

    // Hold eye contact, glancing away briefly so it does not stare.
    gaze.current.copy(camera.position)
    if (Math.sin(t * 0.23) > 0.93) gaze.current.x += 0.5
    lookAt(rig, gaze.current, dt, 1)

    const amplitude = speaking ? (getAmplitude?.() ?? null) : null
    const frame = face.update(dt, { speaking, amplitude, listening })

    if (hasVisemes) {
      for (const name of ALL_VISEMES) {
        setMorph(rig.morphMeshes, name, frame.visemes.get(name) ?? 0)
      }
      setMorph(rig.morphMeshes, 'jawOpen', frame.jawOpen * (1 - (frame.visemes.get('viseme_sil') ?? 0)))
    } else {
      // Accumulate first: several visemes map onto the same ARKit shape and the
      // last writer would otherwise win, making the mouth stutter.
      const blended = new Map()
      for (const [viseme, targets] of Object.entries(ARKIT_FALLBACK)) {
        const weight = frame.visemes.get(viseme) ?? 0
        if (weight <= 0.001) continue
        for (const [shape, factor] of targets) {
          blended.set(shape, Math.min(1, (blended.get(shape) ?? 0) + weight * factor))
        }
      }
      for (const shape of ARKIT_SHAPES) {
        setMorph(rig.morphMeshes, shape, blended.get(shape) ?? 0)
      }
      setMorph(rig.morphMeshes, 'jawOpen', Math.max(blended.get('jawOpen') ?? 0, frame.jawOpen * 0.6))
    }
    setMorph(rig.morphMeshes, 'eyeBlinkLeft', frame.blink)
    setMorph(rig.morphMeshes, 'eyeBlinkRight', frame.blink)
    setMorph(rig.morphMeshes, 'browInnerUp', frame.browInnerUp)
    setMorph(rig.morphMeshes, 'mouthSmile', frame.mouthSmile)
  })

  return (
    <group position={[position[0], position[1] + AVATAR_SINK, position[2]]} rotation={rotation}>
      <primitive object={model} />
    </group>
  )
}

class AvatarBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.warn(
      `No avatar at ${AVATAR_URL}; running the built-in figure instead.`,
      error?.message ?? error,
    )
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

useGLTF.preload(AVATAR_URL)
