#!/usr/bin/env node
// Downscale a tall full-page PNG and lay it out in columns for quick visual review.
// usage: node tools/contact-sheet.mjs <in.png> <out.png> [scale=4] [colHeight=1400]
import fs from 'node:fs';
import { PNG } from 'pngjs';

const [, , inFile, outFile, scaleArg = '4', colArg = '1400'] = process.argv;
if (!inFile || !outFile) {
  console.error('usage: contact-sheet.mjs <in.png> <out.png> [scale] [colHeight]');
  process.exit(1);
}
const scale = Number(scaleArg);
const colH = Number(colArg);
const src = PNG.sync.read(fs.readFileSync(inFile));
const w = Math.floor(src.width / scale);
const h = Math.floor(src.height / scale);
const cols = Math.ceil(h / colH);
const gap = 8;
const out = new PNG({ width: cols * w + (cols - 1) * gap, height: Math.min(h, colH) });
out.data.fill(255);
for (let y = 0; y < h; y++) {
  const col = Math.floor(y / colH);
  const oy = y % colH;
  for (let x = 0; x < w; x++) {
    // box filter
    let r = 0, g = 0, b = 0, n = 0;
    for (let dy = 0; dy < scale; dy++) {
      const sy = y * scale + dy;
      if (sy >= src.height) break;
      for (let dx = 0; dx < scale; dx++) {
        const i = (sy * src.width + x * scale + dx) * 4;
        r += src.data[i]; g += src.data[i + 1]; b += src.data[i + 2]; n++;
      }
    }
    const o = (oy * out.width + col * (w + gap) + x) * 4;
    out.data[o] = r / n; out.data[o + 1] = g / n; out.data[o + 2] = b / n; out.data[o + 3] = 255;
  }
}
fs.writeFileSync(outFile, PNG.sync.write(out));
console.log(`${outFile}: ${out.width}x${out.height} (${cols} columns)`);
