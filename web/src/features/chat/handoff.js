// How the plus menu tells the Update sheet to start: with a picked file, or on the mic. Kept in memory rather than in the
// URL or history state, so a reload opens a plain sheet instead of sending the same file again.
let pending = null

export const handOffUpdate = (start) => {
  pending = start
}

/** what the sheet should start with; read in a state initializer, then cleared with `clearUpdateHandOff` */
export const peekUpdateHandOff = () => pending

export const clearUpdateHandOff = () => {
  pending = null
}
