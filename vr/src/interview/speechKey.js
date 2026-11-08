// Pre-rendered speech clips are looked up by the text itself, so the renderer
// and the player must agree byte for byte on how a line maps to a filename.
// FNV-1a: short, stable across runs, and no dependency.
export function speechKey(text) {
  const normalised = String(text ?? '')
    .trim()
    .replace(/\s+/g, ' ')
  let hash = 0x811c9dc5
  for (let i = 0; i < normalised.length; i++) {
    hash ^= normalised.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}
