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

/** A rounded slab `depth` thick whose front face sits at z = 0. */
export function roundedSlab(width, height, radius, depth) {
  return memo(key('slab', width, height, radius, depth), () => {
    const geometry = new THREE.ExtrudeGeometry(roundedPath(new THREE.Shape(), width, height, radius), {
      depth,
      bevelEnabled: false,
      curveSegments: 10,
    })
    geometry.translate(0, 0, -depth)
    return geometry
  })
}
