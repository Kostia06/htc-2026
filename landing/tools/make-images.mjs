#!/usr/bin/env node
// Render the social preview (public/og.png, 1200x630) and the touch icon
// (public/apple-touch-icon.png, 180x180) from HTML, so they follow the copy in src/content.json.
// usage: node tools/make-images.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './lib/capture.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const content = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content.json'), 'utf8'));
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const icon = fs.readFileSync(path.join(ROOT, 'public/favicon.svg'), 'utf8');

const og = `<!doctype html><html><body style="margin:0">
<div style="box-sizing:border-box;width:1200px;height:630px;padding:72px 80px;display:flex;flex-direction:column;justify-content:space-between;
  font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;color:#fff;
  background:radial-gradient(40% 60% at 85% 20%,rgba(138,92,255,.45),transparent 70%),radial-gradient(35% 55% at 95% 95%,rgba(254,74,35,.4),transparent 70%),#080808">
  <div style="font-size:44px;font-weight:600;letter-spacing:-.04em">${esc(content.wordmark)}</div>
  <div style="font-size:76px;font-weight:600;line-height:1.02;letter-spacing:-.035em;max-width:900px">${esc(content.hero.title)}</div>
  <div style="font-size:30px;color:#a3a3a3;max-width:900px">Applying is one action. Getting hired takes ten.</div>
</div></body></html>`;

const touch = `<!doctype html><html><body style="margin:0;width:180px;height:180px">${icon.replace('<svg ', '<svg width="180" height="180" ')}</body></html>`;

const browser = await launch();
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630 });
  await page.setContent(og);
  await page.screenshot({ path: path.join(ROOT, 'public/og.png') });
  await page.setViewport({ width: 180, height: 180 });
  await page.setContent(touch);
  await page.screenshot({ path: path.join(ROOT, 'public/apple-touch-icon.png') });
  console.log('wrote public/og.png and public/apple-touch-icon.png');
} finally {
  await browser.close();
}
