import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { heightFor, panelLift, recenterTransform, yawOf } from './comfort.js'

const yawed = (angle) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle)

describe('yawOf', () => {
  it('reads the heading of a turned head', () => {
    expect(yawOf(yawed(0))).toBeCloseTo(0)
    expect(yawOf(yawed(Math.PI / 2))).toBeCloseTo(Math.PI / 2)
    expect(yawOf(yawed(-2))).toBeCloseTo(-2)
  })

  it('ignores looking up or down', () => {
    const q = yawed(0.7).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.6))
    expect(yawOf(q)).toBeCloseTo(0.7)
  })
})

describe('recenterTransform', () => {
  it('puts the head in the seat, facing -Z', () => {
    const head = new THREE.Vector3(1.2, 1.1, -0.4)
    const q = yawed(1.1)
    const { x, z, rotationY } = recenterTransform(head, q, { x: 0, z: 0.05 })

    const origin = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), yawed(rotationY), new THREE.Vector3(1, 1, 1))
    const world = head.clone().applyMatrix4(origin)
    expect(world.x).toBeCloseTo(0)
    expect(world.z).toBeCloseTo(0.05)

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(yawed(rotationY).multiply(q))
    expect(forward.x).toBeCloseTo(0)
    expect(forward.z).toBeCloseTo(-1)
  })
})

describe('posture', () => {
  it('seats the eyes level with the interviewer', () => {
    expect(heightFor('seated', 1.1, 1.35)).toBeCloseTo(0.25)
    expect(heightFor('seated', 3, 1.35)).toBe(-0.8)
  })

  it('keeps the real floor standing, and lifts the panels instead', () => {
    expect(heightFor('standing', 1.7, 1.35)).toBe(0)
    expect(panelLift('standing', 1.7, 1.35)).toBeCloseTo(0.35)
    expect(panelLift('seated', 1.7, 1.35)).toBe(0)
  })
})
