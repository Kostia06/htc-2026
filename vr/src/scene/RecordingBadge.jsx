import { Chip, color } from '../theme/index.js'

// While the call is recorded for the replay, the candidate must know it is.
// Kept off the interviewer and out of the air: a small pill lying on the desk
// beside the answer key, like the tally light on a real recorder.
export function RecordingBadge(props) {
  return <Chip text="Recording" face={color.inset} tone="text2" dot={color.negative} {...props} />
}
