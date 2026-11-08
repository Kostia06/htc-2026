// Pure layout for the 3D panels. Troika measures text off-thread, so a panel
// first draws with a guess and then re-lays itself out from the measured
// heights (useTextHeights); these helpers turn those heights into positions.

/** Top offsets (downward, from 0) for blocks stacked with `gap` between them. */
export function stack(heights, gap = 0) {
  const tops = []
  let y = 0
  heights.forEach((h, i) => {
    tops.push(y)
    y += h + (i < heights.length - 1 ? gap : 0)
  })
  return { tops, total: y }
}

/** Splits items into pages of at most `size`. */
export function paginate(items, size = 4) {
  const pages = []
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size))
  return pages
}

// a guess at wrapped height until troika reports the real one
export function guessHeight(text, fontSize, maxWidth, lineHeight = 1.28) {
  const lines = Math.max(1, Math.ceil((String(text ?? '').length * fontSize * 0.55) / maxWidth))
  return lines * fontSize * lineHeight
}
