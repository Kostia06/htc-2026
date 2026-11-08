// Where the interviewer sits. The body, the chair under it and the probes that
// check the mesh against the furniture all read these, so they can't drift apart.
// Verify after any change: `node scripts/mesh-probe.mjs` (no clipping into the
// table, chair or floor) and `npm test`.

// Far enough back that his stomach clears the table edge (z -1.525 at the centre).
export const INTERVIEWER_Z = -1.71
// The chair sits under him rather than behind him, with its back a few centimetres
// behind his. Moving one without the other leaves him perched on the seat edge.
export const INTERVIEWER_CHAIR_Z = INTERVIEWER_Z - 0.05

// Height of his eyes (the eye bones, not the head bone, which sits ~9 cm lower).
// The candidate's view is put at this height so the interview is eye to eye, the
// way it is across a real table. A test checks it against the avatar.
export const INTERVIEWER_EYE_Y = 1.35
