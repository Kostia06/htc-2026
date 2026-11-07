#!/usr/bin/env node
// Side-by-side viewer: reference | candidate | diff for one section, optionally cropped and scaled.
// usage: node tools/stack.mjs <width> <section-name|full> [y0] [y1] [--scale=0.5] [--out=file.png]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pos = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const opt = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const [width, name, y0s, y1s] = pos;
const scale = Number(opt.scale || 0.5);
const file = (kind) =>
  name === 'full' ? path.join(ROOT, '.compare', kind, width, 'full.png') : path.join(ROOT, '.compare', kind, width, 'sections', `${name}.png`);
const imgs = ['reference', 'candidate', 'diff'].map((k) => (fs.existsSync(file(k)) ? PNG.sync.read(fs.readFileSync(file(k))) : null)).filter(Boolean);
const y0 = Number(y0s || 0);
const y1 = Number(y1s || Math.max(...imgs.map((i) => i.height)));
const h = Math.round((y1 - y0) * scale);
const ws = imgs.map((i) => Math.round(i.width * scale));
const out = new PNG({ width: ws.reduce((a, b) => a + b + 6, 0), height: h });
out.data.fill(255);
let ox = 0;
imgs.forEach((img, k) => {
  for (let y = 0; y < h; y++) {
    const sy = Math.floor(y0 + y / scale);
    if (sy >= img.height) continue;
    for (let x = 0; x < ws[k]; x++) {
      const sx = Math.floor(x / scale);
      const s = (sy * img.width + sx) * 4, d = (y * out.width + ox + x) * 4;
      img.data.copy(out.data, d, s, s + 4);
    }
  }
  ox += ws[k] + 6;
});
const dest = opt.out || path.join(ROOT, '.compare', `view-${width}-${name}.png`);
fs.writeFileSync(dest, PNG.sync.write(out));
console.log(dest);
