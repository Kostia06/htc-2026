// Runtime-generated materials. Nothing is downloaded: every map here is drawn
// into a canvas with 2D fills and arithmetic, so the demo looks the same on
// venue wifi, on a hotspot, or with the network cable pulled out.
//
// Sizes are deliberately small. A 512 map is ~1MB of VRAM with mipmaps, and we
// upload a handful of them; the table top gets 1024 because it is the only
// surface the candidate's eyes sit 40cm from, where 512 starts to read as mush.
// Nothing above 1024 — stereo at 72-90fps means we pay for every sampler twice.
//
// Every factory is memoised on its own arguments, so calling it from a hook or
// a module constant is equally safe: you get the same texture object back.
// Generation is a one-off cost at startup. Never call these per frame.

import * as THREE from 'three'

// ---------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------

// mulberry32. Same convention as lipSync.js: no Math.random anywhere, so two
// runs of the demo produce byte-identical textures and the judges see what we
// saw in rehearsal.
export function createRng(seed = 1) {
  let s = seed >>> 0
  return function rng() {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------------------------------------------------------------------------
// Tileable value noise
// ---------------------------------------------------------------------------

// A lattice with independent x/y periods. Independent periods are the whole
// point: equal ones give blobs, unequal ones give grain, flecks and streaks.
// Both periods are integers, so the noise wraps exactly at the texture edge and
// the result tiles with no seam.
function noiseLattice(rng, periodX, periodY) {
  // Rounded, because a fractional period silently truncates the backing array
  // and then reads off the end as NaN, which comes out as a solid black map.
  const px = Math.max(1, Math.round(periodX))
  const py = Math.max(1, Math.round(periodY))
  const a = new Float32Array(px * py)
  for (let i = 0; i < a.length; i++) a[i] = rng()
  return { px, py, a }
}

function fade(t) {
  return t * t * (3 - 2 * t)
}

// Bilinear upsample of one lattice into a full-resolution buffer. Written as a
// row-coherent loop rather than a sample(x, y) function because this runs
// size*size times per octave and the call overhead dominated.
function accumulate(out, lattice, amp, size) {
  const { px, py, a } = lattice
  for (let y = 0; y < size; y++) {
    const fy = (y / size) * py
    const y0 = Math.floor(fy)
    const ty = fade(fy - y0)
    const r0 = (y0 % py) * px
    const r1 = ((y0 + 1) % py) * px
    const row = y * size
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * px
      const x0 = Math.floor(fx)
      const tx = fade(fx - x0)
      const j0 = x0 % px
      const j1 = (x0 + 1) % px
      const n0 = a[r0 + j0] + (a[r0 + j1] - a[r0 + j0]) * tx
      const n1 = a[r1 + j0] + (a[r1 + j1] - a[r1 + j0]) * tx
      out[row + x] += amp * (n0 + (n1 - n0) * ty)
    }
  }
}

// specs: [[periodX, periodY, amplitude], ...] -> Float32Array in 0..1.
function fbm(rng, specs, size) {
  const out = new Float32Array(size * size)
  let norm = 0
  for (const [px, py, amp = 1] of specs) {
    norm += amp
    accumulate(out, noiseLattice(rng, px, py), amp, size)
  }
  for (let i = 0; i < out.length; i++) out[i] /= norm
  return out
}

// ---------------------------------------------------------------------------
// Canvas + texture plumbing
// ---------------------------------------------------------------------------

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  return canvas
}

// Always ask for willReadFrequently. Every factory here does putImageData and
// the derived maps do getImageData; keeping the surface in system memory turned
// a 600ms GPU readback on the 1024 table top into a few milliseconds.
function context2d(canvas) {
  return canvas.getContext('2d', { willReadFrequently: true })
}

function rgb(hex) {
  let h = String(hex).replace('#', '')
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function clamp255(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v
}

const created = new Set()
const cache = new Map()

function memo(key, build) {
  const hit = cache.get(key)
  if (hit) return hit
  const texture = build()
  cache.set(key, texture)
  created.add(texture)
  return texture
}

function finish(canvas, { anisotropy = 4, srgb = true, wrapT = THREE.RepeatWrapping } = {}) {
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = wrapT
  // Data maps (roughness, normal) must not be sRGB-decoded or the response
  // curve is wrong and the surface looks flat.
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  texture.anisotropy = anisotropy
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
}

// Draws the same shape again across whichever edge it straddles, so small
// features (flecks, perforations) never get clipped at the seam.
function wrapped(size, x, y, pad, draw) {
  draw(x, y)
  const dx = x < pad ? size : x > size - pad ? -size : 0
  const dy = y < pad ? size : y > size - pad ? -size : 0
  if (dx) draw(x + dx, y)
  if (dy) draw(x, y + dy)
  if (dx && dy) draw(x + dx, y + dy)
}

/** Disposes every texture this module has handed out and clears the memo cache. */
export function disposeTextures() {
  for (const texture of created) texture.dispose()
  created.clear()
  cache.clear()
}

// ---------------------------------------------------------------------------
// Wood — boardroom table top
// ---------------------------------------------------------------------------

/**
 * Quarter-sawn hardwood. Grain runs along +U, so repeat x on the long axis of
 * the top and leave repeat y at 1.
 *
 * @param {number} size       1024 for the table top, 512 for anything further away.
 * @param {string} baseColor  lighter earlywood
 * @param {string} grainColor darker latewood lines
 * @param {number} rings      growth rings across the V axis; integer, or it will not tile.
 */
export function makeWoodTexture(options = {}) {
  const {
    size = 1024,
    baseColor = '#8a6b4f',
    grainColor = '#4d351f',
    rings = 64,
    anisotropy = 4,
    seed = 11,
  } = options
  return memo(`wood|${size}|${baseColor}|${grainColor}|${rings}|${anisotropy}|${seed}`, () => {
    const canvas = makeCanvas(size, size)
    const ctx = context2d(canvas)
    const rng = createRng(seed)
    const base = rgb(baseColor)
    const grain = rgb(grainColor)

    // Ring displacement. The y periods matter as much as the x ones: if the
    // warp barely changes down the texture every line wobbles in lockstep and
    // you get corrugated iron. Varying it over a few ring widths is what makes
    // neighbouring lines converge and split into cathedral figure.
    const warp = fbm(rng, [[2, 3, 1.5], [3, 7, 1], [7, 17, 0.55], [17, 41, 0.3]], size)
    // Pores: thin and long in x, so they read as grain and not as mud.
    const pore = fbm(rng, [[7, 190, 1], [15, 380, 0.6]], size)
    // Patchy lightness that ignores the rings entirely. Veneer is not one
    // colour between the grain lines.
    const tint = fbm(rng, [[2, 3, 1], [5, 7, 0.5], [11, 15, 0.25]], size)
    // Per-line darkness. Without it every ring is equally black and the top
    // reads as printed laminate rather than a cut board.
    const strength = fbm(rng, [[4, 61, 1], [9, 131, 0.5]], size)

    const img = ctx.createImageData(size, size)
    const d = img.data
    for (let y = 0; y < size; y++) {
      const v = y / size
      for (let x = 0; x < size; x++) {
        const i = y * size + x
        // abs(sin) has period 1, so an integer ring count wraps cleanly in v.
        const phase = v * rings + (warp[i] - 0.5) * 2.4
        const ring = Math.abs(Math.sin(phase * Math.PI))
        // Narrow dark latewood line with a soft shoulder, rather than a fat
        // stripe. The high power is what makes the spacing read as wood: thin
        // dark lines with wide pale earlywood between them.
        const line = (Math.pow(ring, 11) * 0.62 + Math.pow(ring, 3) * 0.16) * (0.4 + strength[i] * 1.3)

        let t = line + (pore[i] - 0.5) * 0.3 + (tint[i] - 0.5) * 0.2
        t = t < 0 ? 0 : t > 1 ? 1 : t

        const lift = 1 + (tint[i] - 0.5) * 0.17
        const o = i * 4
        d[o] = clamp255((base[0] + (grain[0] - base[0]) * t) * lift)
        d[o + 1] = clamp255((base[1] + (grain[1] - base[1]) * t) * lift)
        d[o + 2] = clamp255((base[2] + (grain[2] - base[2]) * t) * lift)
        d[o + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)

    // Hard pore streaks. The noise alone is too soft to survive mipmapping at a
    // glancing angle, and short broken dashes are what you actually see when
    // your eyes are 40cm from the top. Drawn with wrap so they do not clip.
    const dashes = Math.round(size * 2.4)
    const scale = size / 512
    for (let n = 0; n < dashes; n++) {
      const x = rng() * size
      const y = rng() * size
      const w = (6 + rng() * 44) * scale
      const light = rng() < 0.3
      ctx.globalAlpha = light ? 0.04 + rng() * 0.07 : 0.06 + rng() * 0.16
      ctx.fillStyle = light
        ? `rgb(${clamp255(base[0] + 34)},${clamp255(base[1] + 28)},${clamp255(base[2] + 22)})`
        : `rgb(${grain[0]},${grain[1]},${grain[2]})`
      wrapped(size, x, y, 52 * scale, (px, py) => ctx.fillRect(px, py, w, Math.max(1, scale)))
    }
    ctx.globalAlpha = 1

    return finish(canvas, { anisotropy })
  })
}

// ---------------------------------------------------------------------------
// Carpet — commercial loop pile
// ---------------------------------------------------------------------------

/**
 * Loop-pile contract carpet. Only high-frequency content on purpose: any
 * large-scale feature turns into a visible repeating blob once the floor tiles
 * this 8 or more times, which is the usual way a procedural carpet gives
 * itself away.
 */
export function makeCarpetTexture(options = {}) {
  const {
    size = 512,
    baseColor = '#6e6257',
    fleckColor = '#8e8174',
    anisotropy = 4,
    seed = 23,
  } = options
  return memo(`carpet|${size}|${baseColor}|${fleckColor}|${anisotropy}|${seed}`, () => {
    const canvas = makeCanvas(size, size)
    const ctx = context2d(canvas)
    const rng = createRng(seed)
    const base = rgb(baseColor)
    const fleck = rgb(fleckColor)

    // Loops are a few pixels across at 512 over a 0.75m tile, which is about
    // the 4mm a real tuft measures. Nothing coarser than size/8 goes in here.
    const loops = fbm(rng, [[size / 4, size / 4, 1], [size / 2, size / 2, 0.6], [size / 8, size / 8, 0.4]], size)
    // Wider than tall: the slight combed direction every loop pile has.
    const comb = fbm(rng, [[size / 14, size / 4, 1]], size)
    const white = createRng(seed + 1)

    const img = ctx.createImageData(size, size)
    const d = img.data
    for (let i = 0; i < size * size; i++) {
      const shade = loops[i] * 0.7 + comb[i] * 0.3
      const k = 1 + (shade - 0.5) * 0.46 + (white() - 0.5) * 0.07
      const o = i * 4
      d[o] = clamp255(base[0] * k)
      d[o + 1] = clamp255(base[1] * k)
      d[o + 2] = clamp255(base[2] * k)
      d[o + 3] = 255
    }
    ctx.putImageData(img, 0, 0)

    // Flecked yarn. Short horizontal dashes, not dots, so the flecking has the
    // same direction as the pile.
    const count = Math.round((size * size) / 190)
    for (let n = 0; n < count; n++) {
      const x = rng() * size
      const y = rng() * size
      const w = 1 + rng() * 2
      const light = rng() < 0.55
      ctx.globalAlpha = 0.14 + rng() * 0.3
      ctx.fillStyle = light
        ? `rgb(${fleck[0]},${fleck[1]},${fleck[2]})`
        : `rgb(${Math.round(base[0] * 0.6)},${Math.round(base[1] * 0.6)},${Math.round(base[2] * 0.6)})`
      wrapped(size, x, y, 4, (px, py) => ctx.fillRect(px, py, w, 1))
    }
    ctx.globalAlpha = 1

    return finish(canvas, { anisotropy })
  })
}

// ---------------------------------------------------------------------------
// Wall — painted drywall
// ---------------------------------------------------------------------------

/**
 * Rolled matte paint. Contrast is around 3% end to end; if you can see this as
 * a pattern on the wall the amplitude is wrong, not the noise. All it has to do
 * is stop a 6m flat plane from reading as one solid fill.
 */
export function makeWallTexture(options = {}) {
  const { size = 512, baseColor = '#cacdc9', anisotropy = 4, seed = 37 } = options
  return memo(`wall|${size}|${baseColor}|${anisotropy}|${seed}`, () => {
    const canvas = makeCanvas(size, size)
    const ctx = context2d(canvas)
    const rng = createRng(seed)
    const base = rgb(baseColor)

    const mottle = fbm(rng, [[3, 3, 1], [6, 6, 0.5], [13, 13, 0.25]], size)
    // Orange peel from the roller nap.
    const peel = fbm(rng, [[size / 4, size / 4, 1], [size / 2, size / 2, 0.6]], size)
    const white = createRng(seed + 1)

    const img = ctx.createImageData(size, size)
    const d = img.data
    for (let i = 0; i < size * size; i++) {
      const delta = (mottle[i] - 0.5) * 7 + (peel[i] - 0.5) * 4 + (white() - 0.5) * 2.5
      const o = i * 4
      d[o] = clamp255(base[0] + delta)
      d[o + 1] = clamp255(base[1] + delta)
      d[o + 2] = clamp255(base[2] + delta)
      d[o + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
    return finish(canvas, { anisotropy })
  })
}

// ---------------------------------------------------------------------------
// Ceiling tile — mineral fibre acoustic
// ---------------------------------------------------------------------------

/**
 * One acoustic tile per repeat, so set repeat to the tile count (a 6m ceiling
 * of 600mm tiles is repeat 10,10). `groove: false` drops the edge bevel if you
 * want plain perforated board instead.
 */
export function makeCeilingTileTexture(options = {}) {
  const { size = 512, baseColor = '#efeeea', groove = true, anisotropy = 4, seed = 53 } = options
  return memo(`ceiling|${size}|${baseColor}|${groove}|${anisotropy}|${seed}`, () => {
    const canvas = makeCanvas(size, size)
    const ctx = context2d(canvas)
    const rng = createRng(seed)
    const base = rgb(baseColor)

    const fibre = fbm(rng, [[size / 8, size / 8, 1], [size / 3, size / 3, 0.7]], size)
    const white = createRng(seed + 1)

    const img = ctx.createImageData(size, size)
    const d = img.data
    for (let i = 0; i < size * size; i++) {
      const delta = (fibre[i] - 0.5) * 9 + (white() - 0.5) * 3
      const o = i * 4
      d[o] = clamp255(base[0] + delta)
      d[o + 1] = clamp255(base[1] + delta)
      d[o + 2] = clamp255(base[2] + delta)
      d[o + 3] = 255
    }
    ctx.putImageData(img, 0, 0)

    // Stochastic perforations: random positions and sizes, never a grid. The
    // irregularity is the entire reason this reads as acoustic board.
    const holes = Math.round((size * size) / 230)
    const dark = `rgb(${Math.round(base[0] * 0.62)},${Math.round(base[1] * 0.62)},${Math.round(base[2] * 0.63)})`
    ctx.fillStyle = dark
    for (let n = 0; n < holes; n++) {
      const x = rng() * size
      const y = rng() * size
      const r = (0.5 + rng() * 1.3) * (size / 512)
      ctx.globalAlpha = 0.3 + rng() * 0.5
      wrapped(size, x, y, 4, (px, py) => {
        ctx.beginPath()
        ctx.arc(px, py, r, 0, Math.PI * 2)
        ctx.fill()
      })
    }
    ctx.globalAlpha = 1

    if (groove) {
      // Reveal edge: a dark hairline in the tile joint plus a lighter chamfer
      // just inside it. Two strokes, and the ceiling stops being a flat sheet.
      const w = Math.max(1, size / 170)
      ctx.globalAlpha = 0.5
      ctx.strokeStyle = dark
      ctx.lineWidth = w
      ctx.strokeRect(w / 2, w / 2, size - w, size - w)
      ctx.globalAlpha = 0.35
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = w
      ctx.strokeRect(w * 1.6, w * 1.6, size - w * 3.2, size - w * 3.2)
      ctx.globalAlpha = 1
    }

    return finish(canvas, { anisotropy })
  })
}

// ---------------------------------------------------------------------------
// Facade — the city outside the window
// ---------------------------------------------------------------------------

/**
 * Curtain-wall office block. This is the texture that says "20th floor
 * downtown", so it gets the detail: sky reflected down the glass, spandrel
 * bands between floors, mullions, and a minority of windows lit warm in
 * clusters rather than scattered at random (real buildings light up by tenant).
 */
export function makeFacadeTexture(options = {}) {
  const {
    size = 512,
    windowColor = '#36455a',
    litColor = '#ffd9a0',
    wallColor = '#8d949d',
    rows = 24,
    cols = 16,
    anisotropy = 4,
    seed = 71,
  } = options
  return memo(
    `facade|${size}|${windowColor}|${litColor}|${wallColor}|${rows}|${cols}|${anisotropy}|${seed}`,
    () => {
      const canvas = makeCanvas(size, size)
      const ctx = context2d(canvas)
      const rng = createRng(seed)
      const wall = rgb(wallColor)
      const glass = rgb(windowColor)
      const lit = rgb(litColor)

      // Concrete/panel base, written straight into pixels so the mullions can
      // be drawn over the top as crisp geometry.
      const grime = fbm(rng, [[4, 9, 1], [9, 20, 0.5], [size / 6, size / 6, 0.3]], size)
      const img = ctx.createImageData(size, size)
      const d = img.data
      for (let i = 0; i < size * size; i++) {
        const delta = (grime[i] - 0.5) * 20
        const o = i * 4
        d[o] = clamp255(wall[0] + delta)
        d[o + 1] = clamp255(wall[1] + delta)
        d[o + 2] = clamp255(wall[2] + delta)
        d[o + 3] = 255
      }
      ctx.putImageData(img, 0, 0)

      const cw = size / cols
      const ch = size / rows
      const mx = Math.max(1, cw * 0.06) // mullion between columns
      const my = Math.max(1.5, ch * 0.14) // spandrel over each floor slab

      // Spandrel bands: the strip of opaque panel hiding each floor slab.
      ctx.fillStyle = `rgba(${Math.round(wall[0] * 0.8)},${Math.round(wall[1] * 0.8)},${Math.round(wall[2] * 0.84)},0.45)`
      for (let r = 0; r < rows; r++) ctx.fillRect(0, r * ch, size, my)

      // Tenant-scale lighting: a smooth field biased by per-window randomness,
      // so lit offices come in runs instead of salt and pepper.
      const grain = Math.max(cols, rows)
      const clusters = fbm(createRng(seed + 5), [[cols, rows, 1]], grain)
      // What the glass is reflecting, shared between neighbouring panes. A
      // per-pane random tone gives salt and pepper; a smooth field gives a
      // cloud or a neighbouring tower sweeping across the elevation, which is
      // the thing that stops the grid reading as bathroom tile.
      const reflect = fbm(createRng(seed + 9), [[3, 4, 1], [cols, rows, 0.5]], grain)

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * cw + mx
          const y = r * ch + my
          const w = cw - mx * 2
          const h = ch - my * 1.25
          if (w <= 1 || h <= 1) continue

          const cluster = clusters[r * grain + c]
          const isLit = cluster * 0.78 + rng() * 0.22 > 0.72

          if (isLit) {
            const warmth = 0.42 + rng() * 0.55
            ctx.fillStyle = `rgb(${Math.round(lit[0] * warmth)},${Math.round(lit[1] * warmth)},${Math.round(lit[2] * warmth)})`
            ctx.fillRect(x, y, w, h)
            // Whatever is up against the glass: a partition or a desk run
            // eating part of the pane. Breaks the "grid of equal lamps" look.
            if (rng() < 0.55) {
              ctx.fillStyle = `rgba(${Math.round(lit[0] * 0.26)},${Math.round(lit[1] * 0.22)},${Math.round(lit[2] * 0.18)},0.5)`
              ctx.fillRect(x + w * rng() * 0.4, y + h * (0.45 + rng() * 0.3), w * (0.3 + rng() * 0.5), h * 0.55)
            }
          } else {
            // Dark glass is never black, it mirrors whatever is opposite. The
            // tone comes mostly from the shared reflection field so a run of
            // panes catches the same cloud; only a thin top-to-bottom ramp is
            // added. A strong per-pane ramp turns every window into a bevelled
            // button and the whole elevation reads as bathroom tile.
            const sky = 0.62 + reflect[r * grain + c] * 0.95 + rng() * 0.12
            const g = ctx.createLinearGradient(0, y, 0, y + h)
            g.addColorStop(0, `rgb(${Math.round(clamp255(glass[0] * sky + 14))},${Math.round(clamp255(glass[1] * sky + 18))},${Math.round(clamp255(glass[2] * sky + 22))})`)
            g.addColorStop(1, `rgb(${Math.round(clamp255(glass[0] * sky * 0.82))},${Math.round(clamp255(glass[1] * sky * 0.84))},${Math.round(clamp255(glass[2] * sky * 0.9))})`)
            ctx.fillStyle = g
            ctx.fillRect(x, y, w, h)
          }

          // Head reveal: the shadow the slab above drops onto the pane.
          ctx.fillStyle = 'rgba(0,0,0,0.07)'
          ctx.fillRect(x, y, w, Math.max(0.75, h * 0.1))
        }
      }

      // Mullion caps over the joints, drawn last so the extruded aluminium sits
      // proud of the glass the way it does on a real curtain wall.
      ctx.fillStyle = `rgba(${Math.round(clamp255(wall[0] * 1.45))},${Math.round(clamp255(wall[1] * 1.45))},${Math.round(clamp255(wall[2] * 1.45))},0.3)`
      for (let c = 0; c < cols; c++) ctx.fillRect(c * cw, 0, Math.max(0.75, mx * 0.8), size)

      return finish(canvas, { anisotropy })
    },
  )
}

// ---------------------------------------------------------------------------
// Sky
// ---------------------------------------------------------------------------

/**
 * Vertical gradient sky for the backdrop plane beyond the window. `size` is the
 * height; the width is fixed narrow because a gradient has no horizontal
 * detail to store. wrapT is clamped so the top of the sky never bleeds back in
 * at the horizon.
 */
export function makeSkyTexture(options = {}) {
  const {
    size = 512,
    topColor = '#7fa8d4',
    horizonColor = '#e6ecf2',
    haze = 0.45,
    anisotropy = 4,
    seed = 97,
  } = options
  return memo(`sky|${size}|${topColor}|${horizonColor}|${haze}|${anisotropy}|${seed}`, () => {
    const w = 64
    const canvas = makeCanvas(w, size)
    const ctx = context2d(canvas)
    const top = rgb(topColor)
    const horizon = rgb(horizonColor)
    const rng = createRng(seed)

    const img = ctx.createImageData(w, size)
    const d = img.data
    for (let y = 0; y < size; y++) {
      const v = y / (size - 1)
      // Shaped rather than linear: real sky holds its colour most of the way
      // down then washes out fast in the last few degrees above the horizon.
      let t = Math.pow(v, 2.2)
      t = t + haze * Math.pow(v, 7) * (1 - t)
      const r = top[0] + (horizon[0] - top[0]) * t
      const g = top[1] + (horizon[1] - top[1]) * t
      const b = top[2] + (horizon[2] - top[2]) * t
      for (let x = 0; x < w; x++) {
        // Dither: an 8-bit gradient over 512 rows bands visibly otherwise.
        const n = (rng() - 0.5) * 2.5
        const o = (y * w + x) * 4
        d[o] = clamp255(r + n)
        d[o + 1] = clamp255(g + n)
        d[o + 2] = clamp255(b + n)
        d[o + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
    return finish(canvas, { anisotropy, wrapT: THREE.ClampToEdgeWrapping })
  })
}

// ---------------------------------------------------------------------------
// Derived data maps (bonus)
// ---------------------------------------------------------------------------
//
// These two take a finished colour map and read its pixels back, so they are
// not memoised the way the factories above are — there is no stable cache key
// for "this texture plus these options". Build them once alongside the colour
// map and keep the reference. disposeTextures() still cleans them up.

function sourceCanvas(source) {
  return source && source.isTexture ? source.image : source
}

function luminance(source) {
  const canvas = sourceCanvas(source)
  const ctx = context2d(canvas)
  const { width, height } = canvas
  const d = ctx.getImageData(0, 0, width, height).data
  const lum = new Float32Array(width * height)
  for (let i = 0; i < lum.length; i++) {
    const o = i * 4
    lum[i] = (d[o] * 0.299 + d[o + 1] * 0.587 + d[o + 2] * 0.114) / 255
  }
  return { lum, width, height }
}

/**
 * Greyscale roughness derived from a colour map's own luminance, so the two
 * always agree. Varying roughness is most of what sells a surface under one
 * directional light: a uniform roughness reads as plastic no matter how good
 * the albedo is.
 *
 * @param {THREE.Texture|HTMLCanvasElement} source a map from this module
 * @param {number} base      roughness at mid luminance
 * @param {number} variation half the peak-to-peak swing
 * @param {boolean} invert   true for wood/carpet, where the dark parts (open
 *                           pores, crevices) are the rough parts
 */
export function makeRoughnessMap(source, options = {}) {
  const { base = 0.6, variation = 0.2, invert = false, anisotropy = 4 } = options
  const { lum, width, height } = luminance(source)
  const canvas = makeCanvas(width, height)
  const ctx = context2d(canvas)
  const img = ctx.createImageData(width, height)
  const d = img.data
  for (let i = 0; i < lum.length; i++) {
    const signed = (lum[i] - 0.5) * 2 * (invert ? -1 : 1)
    const r = clamp255((base + signed * variation) * 255)
    const o = i * 4
    d[o] = r
    d[o + 1] = r
    d[o + 2] = r
    d[o + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  const texture = finish(canvas, { anisotropy, srgb: false })
  created.add(texture)
  return texture
}

/**
 * Tangent-space normal map from the same luminance, treated as a height field.
 * Sampling wraps, so the normals tile exactly like the colour map they came
 * from. `strength` 0.5 for paint, 2-4 for carpet pile.
 */
export function makeNormalMap(source, options = {}) {
  const { strength = 1.5, anisotropy = 4 } = options
  const { lum, width, height } = luminance(source)
  const canvas = makeCanvas(width, height)
  const ctx = context2d(canvas)
  const img = ctx.createImageData(width, height)
  const d = img.data
  for (let y = 0; y < height; y++) {
    const up = ((y - 1 + height) % height) * width
    const down = ((y + 1) % height) * width
    const row = y * width
    for (let x = 0; x < width; x++) {
      const left = (x - 1 + width) % width
      const right = (x + 1) % width
      const nx = (lum[row + left] - lum[row + right]) * strength
      // Canvas y runs down and texture V runs up, hence down minus up.
      const ny = (lum[down + x] - lum[up + x]) * strength
      const nz = 1
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
      const o = (row + x) * 4
      d[o] = clamp255((nx / len) * 127.5 + 127.5)
      d[o + 1] = clamp255((ny / len) * 127.5 + 127.5)
      d[o + 2] = clamp255((nz / len) * 127.5 + 127.5)
      d[o + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const texture = finish(canvas, { anisotropy, srgb: false })
  created.add(texture)
  return texture
}
