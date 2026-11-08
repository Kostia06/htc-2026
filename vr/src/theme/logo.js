import * as THREE from 'three'

// docs/brand/skillit-logo.svg, drawn with Path2D so the mark needs no image
// request and stays crisp at any texture size. Keep in step with the SVG.
const MARK = {
  viewBox: 1024,
  corner: 224,
  tile: '#0F1311',
  path: 'M 668 318 C 590 250, 350 250, 350 410 C 350 540, 674 500, 674 640 C 674 800, 430 820, 340 726',
  stroke: '#A8C7A3',
  strokeWidth: 112,
  dot: { cx: 704, cy: 286, r: 70, fill: '#E3D1AD' },
}

/** Draws the mark into `ctx` with its top-left at (x, y), `size` pixels square. */
export function drawLogo(ctx, x, y, size, { tile = true } = {}) {
  const s = size / MARK.viewBox
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  if (tile) {
    ctx.fillStyle = MARK.tile
    ctx.beginPath()
    ctx.roundRect(0, 0, MARK.viewBox, MARK.viewBox, MARK.corner)
    ctx.fill()
  }
  ctx.strokeStyle = MARK.stroke
  ctx.lineWidth = MARK.strokeWidth
  ctx.lineCap = 'round'
  ctx.stroke(new Path2D(MARK.path))
  ctx.fillStyle = MARK.dot.fill
  ctx.beginPath()
  ctx.arc(MARK.dot.cx, MARK.dot.cy, MARK.dot.r, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

const cache = new Map()
function canvasTexture(key, w, h, draw) {
  if (cache.has(key)) return cache.get(key)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  draw(canvas.getContext('2d'), w, h)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  cache.set(key, texture)
  return texture
}

/** The app icon on a transparent square. */
export function logoTexture(size = 256) {
  return canvasTexture(`logo${size}`, size, size, (ctx) => drawLogo(ctx, 0, 0, size))
}
