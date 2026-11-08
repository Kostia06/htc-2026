import * as THREE from 'three'

// Rounded-rectangle geometry, shared. A panel re-renders often; building a new
// ShapeGeometry each time would leak GPU buffers, so identical sizes share one.

const cache = new Map()

function roundedPath(path, width, height, radius) {
  const w = width / 2
  const h = height / 2
  const r = Math.min(radius, w, h)
  path.moveTo(-w + r, -h)
  path.lineTo(w - r, -h)
  path.quadraticCurveTo(w, -h, w, -h + r)
  path.lineTo(w, h - r)
  path.quadraticCurveTo(w, h, w - r, h)
  path.lineTo(-w + r, h)
  path.quadraticCurveTo(-w, h, -w, h - r)
  path.lineTo(-w, -h + r)
  path.quadraticCurveTo(-w, -h, -w + r, -h)
  return path
}

const key = (...parts) => parts.map((n) => (typeof n === 'number' ? n.toFixed(4) : n)).join('|')

function memo(k, build) {
  if (!cache.has(k)) cache.set(k, build())
  return cache.get(k)
}

/** A flat rounded rectangle centred on the origin, facing +Z. */
export function roundedRect(width, height, radius) {
  return memo(key('rect', width, height, radius), () =>
    new THREE.ShapeGeometry(roundedPath(new THREE.Shape(), width, height, radius), 10),
  )
}

/** A rounded outline `line` wide, drawn just inside the edge. */
export function roundedOutline(width, height, radius, line) {
  return memo(key('outline', width, height, radius, line), () => {
    const outer = roundedPath(new THREE.Shape(), width, height, radius)
    outer.holes.push(roundedPath(new THREE.Path(), width - line * 2, height - line * 2, Math.max(0, radius - line)))
    return new THREE.ShapeGeometry(outer, 10)
  })
}

/**
 * A rounded slab `depth` thick whose front face sits at z = 0, its edges
 * softened by a `bevel` that stays inside width × height. Material slot 0 is
 * the front and back, slot 1 the sides, so a key can show the phone's darker
 * ledge colour on its sides.
 */
export function roundedSlab(width, height, radius, depth, bevel = 0) {
  return memo(key('slab', width, height, radius, depth, bevel), () => {
    const b = Math.min(bevel, depth / 2, width / 4, height / 4)
    const shape = roundedPath(new THREE.Shape(), width - b * 2, height - b * 2, Math.max(0.001, radius - b))
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: depth - b * 2,
      bevelEnabled: b > 0,
      bevelThickness: b,
      bevelSize: b,
      bevelSegments: 3,
      curveSegments: 10,
    })
    // bevel extends from -b to depth - b; put the front face at z = 0
    geometry.translate(0, 0, -(depth - b))
    return geometry
  })
}

/** A soft, blurred rounded rectangle: the shadow a floating panel drops. */
let shadowTexture = null
export function softShadowTexture() {
  if (shadowTexture) return shadowTexture
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')
  ctx.filter = 'blur(12px)'
  ctx.fillStyle = 'rgba(0,0,0,0.85)'
  ctx.beginPath()
  ctx.roundRect(24, 24, 80, 80, 18)
  ctx.fill()
  shadowTexture = new THREE.CanvasTexture(canvas)
  return shadowTexture
}
