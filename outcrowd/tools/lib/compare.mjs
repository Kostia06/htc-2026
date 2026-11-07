// Pixel comparison of two PNG files (reference vs candidate) with pixelmatch.
// Images of different size are compared on their common top-left area; the size
// difference is reported separately.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

function crop(png, width, height) {
  if (png.width === width && png.height === height) return png;
  const out = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    const s = y * png.width * 4;
    png.data.copy(out.data, y * width * 4, s, s + width * 4);
  }
  return out;
}

/**
 * @returns {{ref:{width,height}, cand:{width,height}, mismatch:number, ratio:number}|null}
 */
export function comparePng(refFile, candFile, diffFile, { threshold = 0.1 } = {}) {
  if (!fs.existsSync(refFile) || !fs.existsSync(candFile)) return null;
  const a = PNG.sync.read(fs.readFileSync(refFile));
  const b = PNG.sync.read(fs.readFileSync(candFile));
  const width = Math.min(a.width, b.width);
  const height = Math.min(a.height, b.height);
  const ca = crop(a, width, height);
  const cb = crop(b, width, height);
  const diff = new PNG({ width, height });
  const mismatch = pixelmatch(ca.data, cb.data, diff.data, width, height, { threshold, alpha: 0.3 });
  if (diffFile) {
    fs.mkdirSync(path.dirname(diffFile), { recursive: true });
    fs.writeFileSync(diffFile, PNG.sync.write(diff));
  }
  return {
    ref: { width: a.width, height: a.height },
    cand: { width: b.width, height: b.height },
    mismatch,
    ratio: mismatch / (width * height || 1),
  };
}
