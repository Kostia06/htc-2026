#!/usr/bin/env node
// Element-by-element layout + computed-style comparison between the snapshot and the rebuild.
// Both pages are loaded and settled exactly like the screenshot tools. Elements are paired
// per section by "tag.classes" + occurrence index (Webflow-only classes ignored), so wrapper
// elements that only existed for Webflow embeds do not break the pairing.
//
// usage: node tools/style-diff.mjs [--url=http://localhost:5180/] [--width=1440]
//                                  [--section=hero,cards] [--props=all|layout] [--max=40]

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './lib/capture.mjs';
import { openReference, settleReference } from './reference.mjs';
import { openCandidate } from './candidate.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const WIDTH = Number(args.width || 1440);
const MAX = Number(args.max || 40);
const ONLY = args.section ? String(args.section).split(',') : null;
const LAYOUT_ONLY = args.props === 'layout';

export const SECTIONS = [
  ['preloader', '#preloader'],
  ['header', '.nav-wrap'],
  ['hero', 'section.hero.home'],
  ['cards', 'section.bg-dark.cards'],
  ['cases-heading', '.case--new-heading-wrap:not(._2)'],
  ['cases-new', 'section.is-cases-new'],
  ['services', 'section.is-cases'],
  ['clients', 'section.is-clients'],
  ['testimonial', 'section.is-testimonial'],
  ['awards', 'section.is-awwards'],
  ['blog', 'section.is-blog'],
  ['faq', 'section.is-faq'],
  ['cta', 'section.is-cta'],
  ['book-call', '.contact-book-a-call'],
  ['footer', 'footer.footer'],
];

const PROPS = [
  'display', 'position', 'z-index', 'overflow', 'visibility', 'opacity', 'transform',
  'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-align', 'white-space', 'color',
  'background-color', 'background-image', 'background-size', 'background-position',
  'border-top-width', 'border-top-color', 'border-top-style', 'border-bottom-width', 'border-bottom-color', 'border-top-left-radius', 'border-bottom-right-radius',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'object-fit', 'gap', 'justify-content', 'align-items', 'flex-direction', 'grid-template-columns', 'cursor', 'pointer-events', 'transition',
];
const LAYOUT_PROPS = ['display', 'position', 'font-size', 'line-height', 'padding-top', 'padding-left', 'margin-top', 'margin-left'];

function extract({ sections, props }) {
  const IGNORE_CLS = /^(w-|swiper-slide-(active|next|prev|duplicate)|w--)/;
  const keyOf = (el) => {
    const cls = [...el.classList].filter((c) => !IGNORE_CLS.test(c)).sort().join('.');
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
  };
  const layoutBox = (el) => {
    let x = 0, y = 0;
    for (let n = el; n; n = n.offsetParent) {
      x += n.offsetLeft;
      y += n.offsetTop;
    }
    return [Math.round(x), Math.round(y), el.offsetWidth, el.offsetHeight];
  };
  const out = {};
  for (const [name, sel] of sections) {
    const root = document.querySelector(sel);
    if (!root) {
      out[name] = null;
      continue;
    }
    const rows = [];
    const seen = {};
    const walk = (el) => {
      const tag = el.tagName.toLowerCase();
      if (['script', 'style', 'link', 'noscript', 'source'].includes(tag)) return;
      if (!(el instanceof HTMLElement)) return; // skip svg internals (lottie)
      if (el.classList.contains('swiper-slide-duplicate')) return;
      const k = keyOf(el);
      const i = (seen[k] = (seen[k] || 0) + 1);
      const cs = getComputedStyle(el);
      const st = {};
      for (const p of props) st[p] = cs.getPropertyValue(p);
      rows.push({ key: `${k}#${i}`, box: layoutBox(el), st, text: (el.childNodes[0]?.nodeType === 3 ? el.childNodes[0].textContent.trim().slice(0, 30) : '') });
      for (const c of el.children) walk(c);
    };
    walk(root);
    out[name] = rows;
  }
  return out;
}

async function grab(page) {
  return page.evaluate(extract, { sections: SECTIONS, props: LAYOUT_ONLY ? LAYOUT_PROPS : PROPS });
}

const norm = (p, v) => {
  if (v == null) return v;
  // round px values to 0.5px to ignore sub-pixel noise
  return v.replace(/-?\d+\.\d+px/g, (m) => (Math.round(parseFloat(m) * 2) / 2).toString() + 'px');
};

async function main() {
  const browser = await launch();
  try {
    const ref = await openReference(browser, WIDTH);
    await settleReference(ref.page);
    const cand = await openCandidate(browser, WIDTH, { url: args.url || 'http://localhost:5180/' });
    await settleReference(cand.page);
    const [A, B] = await Promise.all([grab(ref.page), grab(cand.page)]);
    let total = 0;
    for (const [name] of SECTIONS) {
      if (ONLY && !ONLY.includes(name)) continue;
      const a = A[name], b = B[name];
      if (!a || !b) {
        console.log(`\n## ${name}: ${!a ? 'missing in reference' : 'missing in candidate'}`);
        continue;
      }
      const bm = new Map(b.map((r) => [r.key, r]));
      const am = new Map(a.map((r) => [r.key, r]));
      const issues = [];
      for (const r of a) {
        const c = bm.get(r.key);
        if (!c) {
          issues.push(`  - missing  ${r.key} ${r.text ? `"${r.text}"` : ''}`);
          continue;
        }
        const d = [];
        const db = r.box.map((v, i) => Math.abs(v - c.box[i]));
        if (db.some((v) => v > 1)) d.push(`box ${r.box.join(',')} → ${c.box.join(',')}`);
        for (const p of Object.keys(r.st)) {
          if (norm(p, r.st[p]) !== norm(p, c.st[p])) d.push(`${p}: ${r.st[p]} → ${c.st[p]}`);
        }
        if (d.length) issues.push(`  ~ ${r.key}${r.text ? ` "${r.text}"` : ''}\n      ${d.join('\n      ')}`);
      }
      for (const r of b) if (!am.has(r.key)) issues.push(`  + extra    ${r.key}`);
      total += issues.length;
      console.log(`\n## ${name}: ${issues.length ? issues.length + ' difference(s)' : 'identical'} (ref ${a.length} / cand ${b.length} elements)`);
      for (const line of issues.slice(0, MAX)) console.log(line);
      if (issues.length > MAX) console.log(`  … ${issues.length - MAX} more`);
    }
    console.log(`\nTOTAL ${total}`);
  } finally {
    await browser.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
