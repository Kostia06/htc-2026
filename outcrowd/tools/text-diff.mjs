#!/usr/bin/env node
/**
 * text-diff.mjs — copy / link / alt parity check between the saved outcrowd.io
 * snapshot (reference) and the rebuilt page (candidate).
 *
 * Usage
 *   node tools/text-diff.mjs [reference] [candidate] [options]
 *
 *   reference  file path or URL. Default: $OUTCROWD_REF, else the only .html file in
 *              /Users/kartikmiital/Downloads/assets/127.0.0.1_8081/dl/
 *   candidate  URL of the running dev/preview server (or a file). Default: http://localhost:5173/
 *
 * Options
 *   --visible            only compare text that is rendered (display/visibility) at the viewport.
 *                        Default compares ALL text in the DOM (incl. closed FAQ answers, hover
 *                        duplicates, mobile-only variants).
 *   --viewport=WxH       default 1440x900. Use --all-viewports for 1440x900, 991x900, 390x844.
 *   --all-viewports      run the comparison once per viewport (implies nothing else).
 *   --section=key[,key]  only report these sections.
 *   --copy=path          copy.json used for href / alt / url checks. Default: spec/copy.json
 *   --no-copy-checks     skip the copy.json href / alt / url checks.
 *   --loose-nbsp         treat U+00A0 as a normal space (default: nbsp must match exactly).
 *   --ref-js             run JavaScript on the reference (default: off — the snapshot is static).
 *   --cand-no-js         do not run JavaScript on the candidate (default: on).
 *   --wait=ms            extra settle time after load on the candidate (default 1500).
 *   --ignore=selector    skip elements matching this CSS selector on both pages (e.g. a chat widget).
 *   --json=path          also write the full report as JSON.
 *   --dump               print the extracted strings for both pages and exit 0.
 *
 * Sections
 *   Candidate sections are found by [data-section="<key>"] first, then by the reference
 *   selector (see SECTIONS below). Text outside every section lands in "other".
 *   Elements with [data-text-diff-ignore] and Swiper loop duplicates are skipped.
 *
 * Normalisation: whitespace runs ([ \t\n\r\f]) collapse to one space and are trimmed; <br> counts
 *   as whitespace. Nothing else is normalised (case, punctuation, quotes, nbsp, zwj all count).
 *
 * Exit code: 0 = identical, 1 = differences found, 2 = tool/runtime error.
 */
import { readFileSync, readdirSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { resolve, join, dirname, basename } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(__dirname, '..');
const SNAPSHOT_DIR = '/Users/kartikmiital/Downloads/assets/127.0.0.1_8081/dl';
const CHROME =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/** Page sections in DOM order. `ref` is the selector in the Webflow snapshot. */
export const SECTIONS = [
  { key: 'preloader', ref: '#preloader' },
  { key: 'header', ref: 'header.header-new' },
  { key: 'hero', ref: 'section.hero.home' },
  { key: 'cards', ref: 'section.bg-dark.cards' },
  { key: 'cases-heading', ref: '.case--new-heading-wrap:not(._2)' },
  { key: 'cases-new', ref: 'section.is-cases-new' },
  { key: 'services', ref: 'section.is-cases' },
  { key: 'clients', ref: 'section.is-clients' },
  { key: 'testimonial', ref: 'section.is-testimonial' },
  { key: 'awards', ref: 'section.is-awwards' },
  { key: 'blog', ref: 'section.is-blog' },
  { key: 'faq', ref: 'section.is-faq' },
  { key: 'cta', ref: 'section.is-cta' },
  { key: 'book-call', ref: '.contact-book-a-call' },
  { key: 'footer', ref: 'footer.footer' },
  { key: 'cookies', ref: '.cookies' },
];

export const VIEWPORTS = { desktop: [1440, 900], tablet: [991, 900], mobile: [390, 844] };

/* ------------------------------------------------------------------------------------------ */
/* In-page extraction (runs inside Chrome via page.evaluate)                                  */
/* ------------------------------------------------------------------------------------------ */
function inPageExtract({ sections, visibleOnly, extraIgnore = [] }) {
  const INLINE = new Set(
    'SPAN STRONG EM B I U S SMALL MARK SUB SUP ABBR CODE BR WBR FONT Q TIME DATA BDI BDO CITE DFN KBD SAMP VAR INS DEL'.split(
      ' ',
    ),
  );
  const SKIP = new Set(
    'SCRIPT STYLE NOSCRIPT TEMPLATE SVG IFRAME CANVAS VIDEO AUDIO OBJECT EMBED HEAD TITLE LINK META'.split(' '),
  );
  const SPLIT_CLASSES = ['word', 'char', 'line', 'split-word', 'split-char', 'split-line'];
  const LINE_WORD = ['line', 'word', 'split-line', 'split-word'];
  const IGNORE = ['[data-text-diff-ignore]', '.swiper-slide-duplicate', ...extraIgnore].join(', ');

  const roots = sections.map((s) => {
    const el = document.querySelector(`[data-section="${s.key}"]`) || document.querySelector(s.ref);
    return { key: s.key, el };
  });

  const isInlineWrapper = (el) =>
    INLINE.has(el.tagName.toUpperCase()) ||
    SPLIT_CLASSES.some((c) => el.classList.contains(c)) ||
    el.hasAttribute('data-split') ||
    el.hasAttribute('data-text-diff-inline');

  // text of `el` that sits directly in it or inside inline / split wrappers, ignoring `skip`
  const ownText = (el, skip) => {
    let t = '';
    for (const c of el.childNodes) {
      if (c === skip) continue;
      if (c.nodeType === 3) t += c.nodeValue;
      else if (c.nodeType === 1 && c.tagName !== 'A' && isInlineWrapper(c)) t += ownText(c, skip);
    }
    return t;
  };

  // is this <a> part of running prose ("get in touch at <a>hello@…</a>")?
  const inlineLink = (a) => {
    let p = a.parentElement;
    while (p && p !== document.body && isInlineWrapper(p)) p = p.parentElement;
    return !!p && ownText(p, a).trim() !== '';
  };

  const transparent = (el) => {
    if (isInlineWrapper(el)) return true;
    if (el.tagName.toUpperCase() === 'A' && inlineLink(el)) return true;
    return false;
  };

  const unitOf = (node) => {
    let el = node.nodeType === 1 ? node.parentElement : node.parentElement;
    while (el && el !== document.body && transparent(el)) el = el.parentElement;
    return el;
  };

  const sectionOf = (node) => {
    let best = null;
    for (const r of roots) {
      if (r.el && r.el.contains(node)) {
        if (!best || best.el.contains(r.el)) best = r;
      }
    }
    return best ? best.key : 'other';
  };

  const isVisible = (el) => {
    if (!visibleOnly) return true;
    if (typeof el.checkVisibility === 'function')
      return el.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: false });
    const cs = getComputedStyle(el);
    return el.getClientRects().length > 0 && cs.visibility !== 'hidden';
  };

  const units = []; // { section, text, tag, cls }
  let current = null;
  // plain recursive walk (a TreeWalker filter callback cannot run when page JS is disabled)
  const nodes = [];
  const walk = (el) => {
    for (const c of el.childNodes) {
      if (c.nodeType === 3) nodes.push(c);
      else if (c.nodeType === 1) {
        if (SKIP.has(c.tagName.toUpperCase()) || c.matches(IGNORE)) continue;
        if (c.tagName === 'BR') nodes.push(c);
        // SplitType line/word wrappers replace spaces and <br>s: treat their start as whitespace
        else if (LINE_WORD.some((k) => c.classList.contains(k))) nodes.push({ sep: true, el: c });
        walk(c);
      }
    }
  };
  walk(document.body);
  for (const item of nodes) {
    const n = item.sep ? item.el : item;
    let piece;
    if (item.sep) piece = ' ';
    else if (n.nodeType === 3) piece = n.nodeValue;
    else if (n.tagName === 'BR') piece = '\n';
    else continue;
    const parent = n.nodeType === 3 ? n.parentElement : n;
    if (!parent || !isVisible(parent)) continue;
    const unit = unitOf(n);
    if (item.sep && !(current && current.unit === unit)) continue; // leading separator: nothing to separate
    if (current && current.unit === unit) {
      current.raw += piece;
    } else {
      current = { unit, raw: piece, section: sectionOf(n) };
      units.push(current);
    }
  }

  const out = [];
  for (const u of units) {
    out.push({
      section: u.section,
      raw: u.raw,
      tag: u.unit ? u.unit.tagName.toLowerCase() : 'body',
      cls: u.unit && u.unit.className && typeof u.unit.className === 'string' ? u.unit.className : '',
    });
  }

  const meta = (sel, attr = 'content') => {
    const el = document.querySelector(sel);
    return el ? el.getAttribute(attr) : null;
  };
  const head = {
    lang: document.documentElement.getAttribute('lang'),
    title: document.title,
    description: meta('meta[name="description"]'),
    'og:title': meta('meta[property="og:title"]'),
    'og:description': meta('meta[property="og:description"]'),
    'og:image': meta('meta[property="og:image"]'),
    'og:type': meta('meta[property="og:type"]'),
    'twitter:title': meta('meta[name="twitter:title"]'),
    'twitter:description': meta('meta[name="twitter:description"]'),
    'twitter:image': meta('meta[name="twitter:image"]'),
    'twitter:card': meta('meta[name="twitter:card"]'),
    viewport: meta('meta[name="viewport"]'),
    canonical: meta('link[rel="canonical"]', 'href'),
    icon: meta('link[rel~="icon"]', 'href'),
    'apple-touch-icon': meta('link[rel="apple-touch-icon"]', 'href'),
  };

  const links = [...document.querySelectorAll('a')].map((a) => ({
    href: a.getAttribute('href'),
    target: a.getAttribute('target'),
    section: sectionOf(a),
  }));
  const images = [...document.querySelectorAll('img')].map((img) => ({
    src: img.getAttribute('src'),
    alt: img.getAttribute('alt'),
    section: sectionOf(img),
  }));
  const ariaLabels = [...document.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label'));
  const titles = [...document.querySelectorAll('body [title]')].map((e) => e.getAttribute('title'));
  const missingSections = roots.filter((r) => !r.el).map((r) => r.key);
  const html = document.documentElement.outerHTML;

  return { units: out, head, links, images, ariaLabels, titles, missingSections, html };
}

/* ------------------------------------------------------------------------------------------ */
/* Node side                                                                                   */
/* ------------------------------------------------------------------------------------------ */
export function normalise(s, { looseNbsp = false } = {}) {
  let t = s.replace(/[ \t\n\r\f]+/g, ' ');
  if (looseNbsp) t = t.replace(/ /g, ' ').replace(/ +/g, ' ');
  return t.trim();
}

export function show(s) {
  return s
    .replace(/ /g, '[nbsp]')
    .replace(/‍/g, '[zwj]')
    .replace(/​/g, '[zwsp]')
    .replace(/­/g, '[shy]');
}

export function defaultReference() {
  if (process.env.OUTCROWD_REF) return process.env.OUTCROWD_REF;
  if (!existsSync(SNAPSHOT_DIR)) return null;
  const f = readdirSync(SNAPSHOT_DIR).filter((x) => x.endsWith('.html'));
  return f.length ? join(SNAPSHOT_DIR, f[0]) : null;
}

function toUrl(target) {
  if (/^(https?|file):/i.test(target)) return target;
  const p = resolve(target);
  if (!existsSync(p)) throw new Error(`Not found: ${target}`);
  return pathToFileURL(statSync(p).isDirectory() ? join(p, 'index.html') : p).href;
}

export async function launch() {
  const { default: puppeteer } = await import('puppeteer-core');
  return puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'],
  });
}

/**
 * Load a page and extract per-section text units.
 * @returns {{sections: Record<string,string[]>, units, head, links, images, sources: string[], ...}}
 */
export async function extractPage(
  browser,
  target,
  { js = true, visibleOnly = false, viewport = [1440, 900], wait = 0, offline = false, looseNbsp = false, ignore = [] } = {},
) {
  const url = toUrl(target);
  const page = await browser.newPage();
  await page.setViewport({ width: viewport[0], height: viewport[1], deviceScaleFactor: 1 });
  await page.setJavaScriptEnabled(js);
  const sources = [];
  const origin = /^https?:/.test(url) ? new URL(url).origin : null;
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = req.url();
    // the static reference must not hit trackers / the live site; local files only
    if (offline && /^https?:/i.test(u)) return req.abort();
    req.continue();
  });
  page.on('response', async (res) => {
    try {
      const u = res.url();
      const type = res.request().resourceType();
      if (!['script', 'document', 'xhr', 'fetch'].includes(type)) return;
      if (origin && !u.startsWith(origin) && !u.startsWith('file:')) return;
      sources.push(await res.text());
    } catch {}
  });
  try {
    await page.goto(url, { waitUntil: js ? 'networkidle2' : 'load', timeout: 60000 });
  } catch (e) {
    if (!/timeout/i.test(e.message)) throw e;
  }
  if (wait) await new Promise((r) => setTimeout(r, wait));
  const data = await page.evaluate(inPageExtract, { sections: SECTIONS, visibleOnly, extraIgnore: ignore });
  await page.close();
  const sections = {};
  for (const s of [...SECTIONS.map((x) => x.key), 'other']) sections[s] = [];
  for (const u of data.units) {
    const t = normalise(u.raw, { looseNbsp });
    if (t) sections[u.section].push(t);
  }
  return { url, ...data, sections, sources };
}

/* LCS-based sequence diff → ops [{op:'=',a,b}|{op:'-',a}|{op:'+',b}] */
export function seqDiff(A, B) {
  const n = A.length,
    m = B.length;
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const ops = [];
  let i = 0,
    j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) ops.push({ op: '=', a: A[i++], b: B[j++] });
    else if (L[i + 1][j] >= L[i][j + 1]) ops.push({ op: '-', a: A[i++] });
    else ops.push({ op: '+', b: B[j++] });
  }
  while (i < n) ops.push({ op: '-', a: A[i++] });
  while (j < m) ops.push({ op: '+', b: B[j++] });
  return ops;
}

function similarity(a, b) {
  // Dice coefficient on bigrams — good enough to pair "changed" strings
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const grams = (s) => {
    const m = new Map();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) || 0) + 1);
    }
    return m;
  };
  const ga = grams(a.toLowerCase()),
    gb = grams(b.toLowerCase());
  let inter = 0;
  for (const [g, c] of ga) inter += Math.min(c, gb.get(g) || 0);
  return (2 * inter) / (a.length - 1 + b.length - 1);
}

function firstDiff(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const ctx = (s) => show(s.slice(Math.max(0, i - 15), i + 25));
  return `at char ${i}: ref …${ctx(a)}…  cand …${ctx(b)}…`;
}

/** Compare one section's string lists → list of findings. */
export function compareSection(A, B) {
  const ops = seqDiff(A, B);
  const findings = [];
  let k = 0;
  while (k < ops.length) {
    if (ops[k].op === '=') {
      k++;
      continue;
    }
    const dels = [],
      ins = [];
    while (k < ops.length && ops[k].op !== '=') {
      if (ops[k].op === '-') dels.push(ops[k].a);
      else ins.push(ops[k].b);
      k++;
    }
    // pair up changed strings greedily by similarity
    const usedIns = new Set();
    for (const d of dels) {
      let best = -1,
        bestScore = 0.5;
      ins.forEach((s, idx) => {
        if (usedIns.has(idx)) return;
        const sc = similarity(d, s);
        if (sc > bestScore) {
          bestScore = sc;
          best = idx;
        }
      });
      if (best >= 0) {
        usedIns.add(best);
        findings.push({ type: 'changed', ref: d, cand: ins[best], detail: firstDiff(d, ins[best]) });
      } else findings.push({ type: 'missing', ref: d });
    }
    ins.forEach((s, idx) => {
      if (!usedIns.has(idx)) findings.push({ type: 'extra', cand: s });
    });
  }
  // a string that is both missing and extra in the same section was re-ordered
  const extras = findings.filter((f) => f.type === 'extra');
  for (const f of findings) {
    if (f.type !== 'missing') continue;
    const e = extras.find((x) => x.cand === f.ref && x.type === 'extra');
    if (e) {
      f.type = 'moved';
      e.type = '_drop';
    }
  }
  return findings.filter((f) => f.type !== '_drop');
}

function compareHead(ref, cand) {
  const out = [];
  const imgKeys = new Set(['og:image', 'twitter:image', 'icon', 'apple-touch-icon']);
  for (const k of Object.keys(ref)) {
    const a = ref[k],
      b = cand[k];
    if (a == null) continue;
    if (k === 'canonical') {
      if (a !== b) out.push({ type: 'changed', ref: `${k}: ${a}`, cand: `${k}: ${b}` });
      continue;
    }
    if (imgKeys.has(k)) {
      // assets are re-hosted: compare file names only
      const fa = decodeURIComponent(basename(a.split('?')[0]));
      const fb = b ? decodeURIComponent(basename(b.split('?')[0])) : null;
      if (fa !== fb) out.push({ type: b ? 'changed' : 'missing', ref: `${k}: ${fa}`, cand: b ? `${k}: ${fb}` : undefined });
      continue;
    }
    if (b == null) out.push({ type: 'missing', ref: `${k}: ${a}` });
    else if (a !== b) out.push({ type: 'changed', ref: `${k}: ${a}`, cand: `${k}: ${b}`, detail: firstDiff(a, b) });
  }
  return out;
}

/** href / target / alt / url checks driven by spec/copy.json */
function copyChecks(copy, cand) {
  const out = [];
  const warn = [];
  const index = copy.index || {};
  const candLinks = cand.links;
  const sameHref = (a, b) => {
    if (a === b) return true;
    // "" (Calendly anchors) and "#…" must match literally; everything else may differ only in form
    if (!a || !b || a.startsWith('#') || b.startsWith('#')) return false;
    try {
      const base = 'https://www.outcrowd.io/';
      return new URL(a, base).href === new URL(b, base).href;
    } catch {
      return false;
    }
  };
  for (const l of index.hrefs || []) {
    const matches = candLinks.filter((c) => c.href != null && sameHref(l.href, c.href));
    if (!matches.length) {
      out.push({ type: 'missing', ref: `href="${l.href}" (${l.count}× in ${l.sections.join(', ')})` });
      continue;
    }
    if (l.blankCount && matches.filter((m) => m.target === '_blank').length < l.blankCount)
      out.push({
        type: 'changed',
        ref: `href="${l.href}" target=_blank ×${l.blankCount}`,
        cand: `target=_blank ×${matches.filter((m) => m.target === '_blank').length}`,
      });
    if (matches.length !== l.count)
      warn.push(`href="${l.href}": reference has ${l.count} links, candidate has ${matches.length}`);
  }
  const candAlts = new Set(cand.images.map((i) => i.alt).filter((a) => a));
  for (const a of index.alts || []) {
    if (a && !candAlts.has(a)) out.push({ type: 'missing', ref: `img alt="${a}"` });
  }
  const noAlt = cand.images.filter((i) => i.alt == null).length;
  if (noAlt) warn.push(`${noAlt} candidate <img> without an alt attribute (reference: every <img> has alt="")`);
  for (const a of index.ariaLabels || []) if (!cand.ariaLabels.includes(a)) out.push({ type: 'missing', ref: `aria-label="${a}"` });
  for (const t of index.titles || []) if (!cand.titles.includes(t)) out.push({ type: 'missing', ref: `title="${t}"` });
  const haystack = [cand.html, ...cand.sources].join('\n');
  for (const u of index.urls || []) {
    if (!haystack.includes(u)) out.push({ type: 'missing', ref: `url/string in page or same-origin JS: ${u}` });
  }
  return { findings: out, warnings: warn };
}

function printFindings(title, findings, counts) {
  const head = counts ? `${title}  (ref ${counts[0]} / cand ${counts[1]} strings)` : title;
  if (!findings.length) {
    console.log(`  ok   ${head}`);
    return;
  }
  console.log(`\n  FAIL ${head} — ${findings.length} difference(s)`);
  for (const f of findings) {
    if (f.type === 'missing') console.log(`       - missing: "${show(f.ref)}"`);
    else if (f.type === 'extra') console.log(`       + extra:   "${show(f.cand)}"`);
    else if (f.type === 'moved') console.log(`       ~ moved (order differs): "${show(f.ref)}"`);
    else {
      console.log(`       ~ changed: "${show(f.ref)}"`);
      console.log(`              →   "${show(f.cand ?? '')}"`);
      if (f.detail) console.log(`              ${f.detail}`);
    }
    if (f.elsewhere) console.log(`              (found in section "${f.elsewhere}")`);
  }
  console.log('');
}

function parseArgs(argv) {
  const opts = { _: [] };
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) opts[m[1]] = m[2] ?? true;
    else opts._.push(a);
  }
  return opts;
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.help || o.h) {
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]);
    return 0;
  }
  const ref = o._[0] || defaultReference();
  const cand = o._[1] || 'http://localhost:5173/';
  if (!ref) throw new Error('No reference given and no snapshot found');
  const looseNbsp = !!o['loose-nbsp'];
  const only = o.section ? String(o.section).split(',') : null;
  const viewports = o['all-viewports']
    ? Object.values(VIEWPORTS)
    : [String(o.viewport || '1440x900').split('x').map(Number)];
  const copyPath = resolve(PROJECT, o.copy || 'spec/copy.json');
  const copy = !o['no-copy-checks'] && existsSync(copyPath) ? JSON.parse(readFileSync(copyPath, 'utf8')) : null;

  const browser = await launch();
  const report = { reference: ref, candidate: cand, runs: [] };
  let total = 0;
  try {
    for (const vp of viewports) {
      const ignore = o.ignore ? [String(o.ignore)] : [];
      const common = { visibleOnly: !!o.visible, viewport: vp, looseNbsp, ignore };
      const R = await extractPage(browser, ref, { ...common, js: !!o['ref-js'], offline: !o['ref-js'] });
      const C = await extractPage(browser, cand, { ...common, js: !o['cand-no-js'], wait: Number(o.wait ?? 1500) });
      if (o.dump) {
        console.log(JSON.stringify({ viewport: vp, reference: R.sections, candidate: C.sections }, null, 2));
        continue;
      }
      console.log(
        `\ntext-diff  viewport ${vp.join('x')}  mode ${o.visible ? 'visible' : 'dom'}${looseNbsp ? ' loose-nbsp' : ''}`,
      );
      console.log(`  reference: ${R.url}\n  candidate: ${C.url}`);
      if (C.missingSections.length)
        console.log(
          `  note: candidate sections not found (add data-section="<key>"): ${C.missingSections.join(', ')}`,
        );
      const run = { viewport: vp, sections: {}, head: [], copy: null };

      if (!only || only.includes('head')) {
        run.head = compareHead(R.head, C.head);
        printFindings('head', run.head);
        total += run.head.length;
      }
      const keys = [...SECTIONS.map((s) => s.key), 'other'];
      // where else does a string live in the candidate? (helps diagnose wrong section mapping)
      const candWhere = new Map();
      for (const k of keys) for (const s of C.sections[k]) if (!candWhere.has(s)) candWhere.set(s, k);
      for (const k of keys) {
        if (only && !only.includes(k)) continue;
        const f = compareSection(R.sections[k], C.sections[k]);
        for (const x of f) if (x.type === 'missing' && candWhere.has(x.ref)) x.elsewhere = candWhere.get(x.ref);
        run.sections[k] = { ref: R.sections[k].length, cand: C.sections[k].length, findings: f };
        printFindings(k, f, [R.sections[k].length, C.sections[k].length]);
        total += f.length;
      }
      if (copy && !only) {
        const cc = copyChecks(copy, C);
        run.copy = cc;
        printFindings('copy.json hrefs / targets / alts / urls', cc.findings);
        for (const w of cc.warnings) console.log(`  warn ${w}`);
        total += cc.findings.length;
      } else if (!copy && !o['no-copy-checks']) console.log(`  warn ${copyPath} not found — href/alt checks skipped`);
      report.runs.push(run);
    }
  } finally {
    await browser.close();
  }
  if (o.json) writeFileSync(resolve(o.json), JSON.stringify(report, null, 2));
  if (o.dump) return 0;
  console.log(total ? `\nRESULT: ${total} difference(s)\n` : '\nRESULT: identical\n');
  return total ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(err?.stack || err);
      process.exit(2);
    },
  );
}
