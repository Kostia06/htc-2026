#!/usr/bin/env node
// Compare interaction states (scroll positions, hovers, clicks) between the snapshot and the rebuild.
// Both pages are settled like the screenshot tools, then every scenario is replayed on each
// page and the viewport is captured and pixel-compared.
//
// usage: node tools/interactions.mjs [--url=http://localhost:5180/] [--width=1440] [--only=name,name]
// output: .compare/interactions/<width>/<name>.{ref,cand,diff}.png

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, shoot, sleep } from './lib/capture.mjs';
import { openReference, settleReference } from './reference.mjs';
import { openCandidate } from './candidate.mjs';
import { comparePng } from './lib/compare.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const WIDTH = Number(args.width || 1440);
const ONLY = args.only ? String(args.only).split(',') : null;

/** helpers usable in scenarios */
const scrollTo = (page, y) => page.evaluate((y) => window.scrollTo(0, y), y);
const scrollToEl = (page, sel, offset = 0) =>
  page.evaluate(
    (sel, offset) => {
      const el = document.querySelector(sel);
      window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + offset);
    },
    sel,
    offset,
  );
async function hover(page, sel, dx = 0.5, dy = 0.5) {
  const box = await page.evaluate((sel) => {
    const r = document.querySelector(sel).getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }, sel);
  await page.mouse.move(box.x + box.w * dx - 3, box.y + box.h * dy - 3);
  await page.mouse.move(box.x + box.w * dx, box.y + box.h * dy, { steps: 4 });
}

const DESKTOP = [
  ['scroll-hero-mid', async (p) => scrollTo(p, 700)],
  ['scroll-hero-end', async (p) => scrollTo(p, 1300)],
  ['scroll-cards-fan', async (p) => scrollTo(p, 1950)],
  ['scroll-stages-1', async (p) => scrollToEl(p, '.height-cases', 900)],
  ['scroll-stages-2', async (p) => scrollToEl(p, '.height-cases', 1900)],
  ['scroll-services-head', async (p) => scrollToEl(p, 'section.is-cases', -300)],
  ['scroll-clients-brands', async (p) => scrollToEl(p, 'section.is-clients', -200)],
  ['scroll-awards-in', async (p) => scrollToEl(p, 'section.is-awwards', -350)],
  ['scroll-blog-in', async (p) => scrollToEl(p, 'section.is-blog', -300)],
  ['scroll-faq-in', async (p) => scrollToEl(p, 'section.is-faq', -300)],
  ['nav-collapsed', async (p) => { await scrollTo(p, 3000); await sleep(300); await scrollTo(p, 3300); }],
  ['nav-contact-hover', async (p) => { await scrollTo(p, 0); await hover(p, '.header-btn-wrap .nav_link-c.contact:not(.grey)'); }],
  ['nav-link-flip', async (p) => { await scrollTo(p, 0); await hover(p, '.nav-link-wrap .footer-link'); }],
  ['service-card-spotlight', async (p) => { await scrollToEl(p, '#cards', 100); await sleep(600); await hover(p, '.service-card.set-1', 0.3, 0.4); }],
  ['startup-hover', async (p) => { await scrollToEl(p, '.startup-list', -100); await sleep(600); await hover(p, '.startup-list-item', 0.5, 0.3); }],
  ['secondary-btn-hover', async (p) => { await scrollToEl(p, '.startup-list', -100); await sleep(600); await hover(p, '.btn-secondary.m-2-3'); }],
  ['slide-hover', async (p) => { await scrollToEl(p, '.swiper', -200); await sleep(600); await hover(p, '.swiper-slide-active'); }],
  ['award-row-hover', async (p) => { await scrollToEl(p, '.awards-list', 0); await sleep(600); await hover(p, '.awards-list-item-wrap:not(.hide) .awards-list-item', 0.3); }],
  ['faq-open', async (p) => {
    await scrollToEl(p, '.faq-wrap', -100);
    await sleep(600);
    await p.click('.faq-dropdown .dropdown-toggle');
  }],
  ['cta-write-hover', async (p) => { await scrollToEl(p, '.cta-card-wrapper', -100); await sleep(600); await hover(p, '.nav_link-cta.orange', 0.3); }],
  ['footer-social-hover', async (p) => { await scrollTo(p, 1e6); await sleep(600); await hover(p, 'footer .social-footer-wrap', 0.7, 0.3); }],
];
const MOBILE = [
  ['m-scroll-hero', async (p) => scrollTo(p, 400)],
  ['m-cards-reveal', async (p) => scrollToEl(p, 'section.bg-dark.cards', -400)],
  ['m-stages', async (p) => scrollToEl(p, '.case-mob-wrap', 0)],
  ['m-burger-open', async (p) => { await scrollTo(p, 0); await sleep(300); await p.click('.burger-wrap'); }],
  ['m-faq-open', async (p) => { await scrollToEl(p, '.faq-wrap', -100); await sleep(600); await p.click('.faq-dropdown .dropdown-toggle'); }],
];

async function runAll(page, scenarios, kind, dir) {
  for (const [name, fn] of scenarios) {
    if (ONLY && !ONLY.includes(name)) continue;
    await page.mouse.move(1, 1);
    await fn(page);
    await sleep(1500);
    fs.writeFileSync(path.join(dir, `${name}.${kind}.png`), await shoot(page));
    // reset between scenarios: reload is too slow, so just move away and go back to the top
    await page.mouse.move(1, 1);
    await page.evaluate(() => document.body.click());
    await scrollTo(page, 0);
    await sleep(800);
  }
}

async function main() {
  const scenarios = WIDTH <= 767 ? MOBILE : DESKTOP;
  const dir = path.join(ROOT, '.compare', 'interactions', String(WIDTH));
  fs.mkdirSync(dir, { recursive: true });
  const browser = await launch();
  try {
    const ref = await openReference(browser, WIDTH);
    await settleReference(ref.page);
    await runAll(ref.page, scenarios, 'ref', dir);
    const cand = await openCandidate(browser, WIDTH, { url: args.url || 'http://localhost:5180/' });
    await settleReference(cand.page);
    await runAll(cand.page, scenarios, 'cand', dir);
  } finally {
    await browser.close();
  }
  console.log(`[${WIDTH}] interaction states`);
  for (const [name] of scenarios) {
    if (ONLY && !ONLY.includes(name)) continue;
    const r = comparePng(path.join(dir, `${name}.ref.png`), path.join(dir, `${name}.cand.png`), path.join(dir, `${name}.diff.png`));
    console.log(`  ${name.padEnd(24)} ${r ? (r.ratio * 100).toFixed(2).padStart(6) + '%' : 'n/a'}`);
  }
}

await main();
