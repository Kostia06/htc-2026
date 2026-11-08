// Comfort maths, kept pure: where to put the XR origin so the candidate ends
// up in the seat, facing the interviewer, at the right eye height. Nothing
// here ever moves the camera on its own; these only run when the candidate
// asks (Recenter, a posture change) or once when the session starts.

export const HEIGHT_RANGE = [-0.8, 1.0]
export const POSTURES = ['seated', 'standing']

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/** Yaw (radians about +Y) of a head looking along its -Z, from a quaternion {x,y,z,w}. */
export function yawOf(q) {
  // forward = q * (0, 0, -1)
  const fx = -2 * (q.x * q.z + q.w * q.y)
  const fz = -(1 - 2 * (q.x * q.x + q.y * q.y))
  return Math.atan2(-fx, -fz)
}

/**
 * The origin transform that maps the head's current pose (in the session's own
 * reference space) onto `seat`, looking down -Z. Returns { x, z, rotationY }.
 */
export function recenterTransform(head, quaternion, seat = { x: 0, z: 0 }) {
  const rotationY = -yawOf(quaternion)
  const cos = Math.cos(rotationY)
  const sin = Math.sin(rotationY)
  const x = head.x * cos + head.z * sin
  const z = -head.x * sin + head.z * cos
  return { x: seat.x - x, z: seat.z - z, rotationY }
}

/**
 * Vertical origin offset for a posture. Seated puts the eyes level with the
 * interviewer's, whatever the chair; standing keeps the real floor.
 */
export function heightFor(posture, realEyeHeight, interviewerEyeY) {
  if (posture === 'standing') return 0
  return clamp(interviewerEyeY - realEyeHeight, HEIGHT_RANGE[0], HEIGHT_RANGE[1])
}

/** How far to raise the panels so a standing candidate is not reading at their belt. */
export function panelLift(posture, realEyeHeight, interviewerEyeY) {
  if (posture !== 'standing' || !(realEyeHeight > 0)) return 0
  return clamp(realEyeHeight - interviewerEyeY, 0, 0.45)
}

export const isPlausibleEyeHeight = (y) => y > 0.3 && y < 2.3
