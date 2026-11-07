#!/usr/bin/env node
// Capture the page (full page + one PNG per section) at each width, then compare every section
// with an earlier capture in .compare/<ref>/<width>/ (default: baseline). Sizes show whether the
// layout moved; the diff ratio shows how much of the content changed.
//
// usage: node tools/candidate.mjs [--url=http://localhost:5180/] [--widths=1440,991,390]
//                                 [--only=02-hero,03-cards] [--no-full] [--ref=baseline]
// output: .compare/candidate/<w>/{full.png,sections/*.png,meta.json}
//         .compare/diff/<w>/{full.png,sections/*.png}  (red = differing pixels)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, preparePage, captureFullPage, captureSections, scrollPass, stabilize, waitVisualSettle, sleep, SECTIONS } from './lib/capture.mjs';
import { comparePng } from './lib/compare.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const URL_ = args.url || 'http://localhost:5180/';
const WIDTHS = String(args.widths || '1440,991,390').split(',').map(Number);
const ONLY = args.only ? String(args.only).split(',') : null;
const REF = String(args.ref || 'baseline');

async function settle(page) {
  // let the preloader finish, then trigger every scroll animation once and freeze loops
  await sleep(3000);
  await page.evaluate(() => {
    const p = document.getElementById('preloader');
    if (p) p.style.display = 'none';
  });
  await scrollPass(page);
  await stabilize(page);
  await waitVisualSettle(page);
}

export async function openCandidate(browser, width, { url = URL_, log = () => {} } = {}) {
  const { page, vp } = await preparePage(browser, width);
  page.on('pageerror', (e) => log('pageerror:', e.message.split('\n')[0]));
  page.on('console', (m) => m.type() === 'error' && log('console:', m.text()));
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
  return { page, vp };
}

async function run(width) {
  const outDir = path.join(ROOT, '.compare', 'candidate', String(width));
  const refDir = path.join(ROOT, '.compare', REF, String(width));
  const diffDir = path.join(ROOT, '.compare', 'diff', String(width));
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await launch();
  const logs = [];
  const log = (...a) => logs.push(a.join(' '));
  try {
    const { page } = await openCandidate(browser, width, { log });
    await settle(page);
    const sections = SECTIONS.filter(([n]) => !ONLY || ONLY.some((o) => n.includes(o)));
    const res = [];
    if (!args['no-full']) {
      await captureFullPage(page, path.join(outDir, 'full.png'));
      res.push(['full', comparePng(path.join(refDir, 'full.png'), path.join(outDir, 'full.png'), path.join(diffDir, 'full.png'))]);
    }
    const shots = await captureSections(page, path.join(outDir, 'sections'), { sections });
    for (const s of shots) {
      if (s.missing) {
        res.push([s.name, null]);
        continue;
      }
      const f = `${s.name}.png`;
      res.push([s.name, comparePng(path.join(refDir, 'sections', f), path.join(outDir, 'sections', f), path.join(diffDir, 'sections', f))]);
    }
    fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify({ width, sections: shots, logs }, null, 2));
    console.log(`\n[${width}]`);
    for (const [name, r] of res) {
      if (!r) {
        console.log(`  ${name.padEnd(18)} missing`);
        continue;
      }
      const size =
        r.ref.width === r.cand.width && r.ref.height === r.cand.height
          ? `${r.ref.width}x${r.ref.height}`
          : `ref ${r.ref.width}x${r.ref.height} / cand ${r.cand.width}x${r.cand.height}`;
      console.log(`  ${name.padEnd(18)} ${(r.ratio * 100).toFixed(2).padStart(6)}%  ${size}`);
    }
    if (logs.length) console.log('  logs:\n   ', [...new Set(logs)].slice(0, 15).join('\n    '));
  } finally {
    await browser.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const w of WIDTHS) await run(w);
}
