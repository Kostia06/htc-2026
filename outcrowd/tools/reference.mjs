#!/usr/bin/env node
// Reference rendering harness: renders the saved outcrowd.io snapshot in headless
// Chrome, serving every asset from the local mirror, and writes deterministic
// screenshots to .compare/reference/<width>/.
//
// usage: node tools/reference.mjs [1440|991|390 ...]   (default: all three)
//        SNAPSHOT_DIR=/path/to/assets node tools/reference.mjs 1440
//        OFFLINE=1 -> never touch the network (lotties/split-type/mp3 served from public/ or node_modules)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  launch,
  preparePage,
  scrollPass,
  stabilize,
  captureFullPage,
  captureSections,
  waitVisualSettle,
  sleep,
} from './lib/capture.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOT_DIR = process.env.SNAPSHOT_DIR || '/Users/kartikmiital/Downloads/assets';
const PAGE_DIR = path.join(SNAPSHOT_DIR, '127.0.0.1_8081', 'dl');
const ORIGIN = 'https://www.outcrowd.io';
const OFFLINE = !!process.env.OFFLINE;

const BLOCK = [
  /googletagmanager\.com/,
  /google-analytics\.com/,
  /contentsquare\.net/,
  /licdn\.com/,
  /linkedin\.com/,
  /zoho(public)?\.(eu|com)/,
  /pagesense\.io/,
  /calendly\.com/,
  /luckyorange/,
  /@finsweet\/cookie-consent/, // cookie banner script (banner kept hidden for captures)
  /px\.ads/,
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
};

function snapshotHtmlPath() {
  const files = fs.readdirSync(PAGE_DIR).filter((f) => f.endsWith('.html'));
  if (files.length !== 1) throw new Error(`expected exactly one html in ${PAGE_DIR}, got ${files.length}`);
  return path.join(PAGE_DIR, files[0]);
}

function loadSnapshotHtml() {
  let html = fs.readFileSync(snapshotHtmlPath(), 'utf8');
  // The snapshot was serialised from an iPhone session: drop the baked-in touch flag,
  // Webflow re-adds w-mod-js / w-mod-touch itself at runtime when appropriate.
  html = html.replace(/(<html[^>]*class=")[^"]*(")/, '$1$2');
  return html;
}

// Original URL -> local file inside the mirror.
// The mirror stores  <host>/<url-decoded path>  and folds a query string into the
// file name before the extension:  name.ext?q=1  ->  name_q=1.ext
function mirrorPath(u) {
  const host = u.hostname;
  let p;
  try {
    p = decodeURIComponent(u.pathname);
  } catch {
    p = u.pathname;
  }
  const base = path.join(SNAPSHOT_DIR, host, p);
  const cands = [];
  if (u.search) {
    const q = (() => {
      try {
        return decodeURIComponent(u.search.slice(1));
      } catch {
        return u.search.slice(1);
      }
    })();
    const ext = path.extname(base);
    cands.push(base.slice(0, base.length - ext.length) + '_' + q + ext);
  }
  cands.push(base);
  return cands.find((c) => c.startsWith(SNAPSHOT_DIR) && fs.existsSync(c) && fs.statSync(c).isFile());
}

// Assets missing from the snapshot that were downloaded into public/ (spec/assets.json).
let EXTRA = {};
try {
  const map = JSON.parse(fs.readFileSync(path.join(ROOT, 'spec', 'assets.json'), 'utf8'));
  for (const [orig, local] of Object.entries(map.assets || map)) {
    if (typeof local === 'string') EXTRA[orig] = path.join(ROOT, 'public', local.replace(/^\//, ''));
  }
} catch {}
EXTRA['https://unpkg.com/split-type'] = path.join(ROOT, 'node_modules', 'split-type', 'umd', 'index.min.js');

function extraPath(u) {
  const keys = [u.href, decodeURI(u.href)];
  for (const k of keys) if (EXTRA[k] && fs.existsSync(EXTRA[k])) return EXTRA[k];
  return null;
}

function resolveLocal(url) {
  const u = new URL(url);
  if (u.origin === ORIGIN) {
    if (u.pathname === '/' || u.pathname === '/index.html') return { html: true };
    // relative "../../<host>/<path>" refs resolve to https://www.outcrowd.io/<host>/<path>
    const m = u.pathname.match(/^\/([^/]+)(\/.*)$/);
    if (m && fs.existsSync(path.join(SNAPSHOT_DIR, m[1]))) {
      const inner = new URL(`https://${m[1]}${m[2]}${u.search}`);
      const f = mirrorPath(inner) || extraPath(inner);
      if (f) return { file: f };
      return { missing: inner.href };
    }
    return { notFound: true };
  }
  const f = mirrorPath(u);
  if (f) return { file: f };
  const x = OFFLINE || u.hostname === 'cdn.prod.website-files.com' || u.hostname.endsWith('dropboxusercontent.com') || u.hostname === 'unpkg.com' ? extraPath(u) : null;
  if (x) return { file: x };
  return null; // network
}

export async function openReference(browser, width, { log = () => {} } = {}) {
  const { page, vp } = await preparePage(browser, width);
  const html = loadSnapshotHtml();
  const stats = { local: 0, network: [], blocked: 0, missing: [] };
  await page.setRequestInterception(true);
  page.on('request', async (req) => {
    const url = req.url();
    try {
      if (url.startsWith('data:') || url.startsWith('blob:')) return req.continue();
      if (BLOCK.some((re) => re.test(url))) {
        stats.blocked++;
        return req.abort('blockedbyclient');
      }
      const r = resolveLocal(url);
      if (r && r.html) {
        return req.respond({ status: 200, contentType: MIME['.html'], body: html });
      }
      if (r && r.file) {
        stats.local++;
        const ext = path.extname(r.file).toLowerCase();
        return req.respond({
          status: 200,
          contentType: MIME[ext] || 'application/octet-stream',
          headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
          body: fs.readFileSync(r.file),
        });
      }
      if (r && (r.notFound || r.missing)) {
        if (r.missing) stats.missing.push(r.missing);
        return req.respond({ status: 404, contentType: 'text/plain', body: 'not in snapshot' });
      }
      if (OFFLINE) {
        stats.missing.push(url);
        return req.respond({ status: 404, contentType: 'text/plain', body: 'offline' });
      }
      stats.network.push(url);
      return req.continue();
    } catch (e) {
      log('request error', url, e.message);
      try {
        req.abort();
      } catch {}
    }
  });
  page.on('pageerror', (e) => log('pageerror:', e.message.split('\n')[0]));
  await page.goto(ORIGIN + '/', { waitUntil: 'networkidle2', timeout: 90000 });
  return { page, vp, stats };
}

/** Load, run preloader, trigger everything, freeze. Leaves the page at scrollY=0. */
export async function settleReference(page) {
  // preloader IX (a-178) runs ~2.9s after the auto-click; give it margin
  await sleep(4000);
  await page.evaluate(() => {
    const p = document.getElementById('preloader');
    if (p) p.style.display = 'none';
  });
  await scrollPass(page);
  await stabilize(page);
  await waitVisualSettle(page);
}

async function run(width) {
  const outDir = path.join(ROOT, '.compare', 'reference', String(width));
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await launch();
  const logs = [];
  const log = (...a) => logs.push(a.join(' '));
  try {
    const { page, stats } = await openReference(browser, width, { log });
    await settleReference(page);
    const frozen = await page.evaluate(() => window.__frozenLotties);
    const full = await captureFullPage(page, path.join(outDir, 'full.png'));
    const sections = await captureSections(page, path.join(outDir, 'sections'));
    const meta = { width, full, sections, frozenLotties: frozen, requests: { ...stats, network: [...new Set(stats.network)] }, logs };
    fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 2));
    console.log(
      `[${width}] full ${full.width}x${full.height}, ${sections.filter((s) => !s.missing).length}/${sections.length} sections, ` +
        `lotties frozen: ${frozen}, local ${stats.local}, network ${meta.requests.network.length}, blocked ${stats.blocked}, missing ${stats.missing.length}`,
    );
    if (stats.missing.length) console.log('  missing:', [...new Set(stats.missing)].slice(0, 10).join('\n           '));
    for (const s of sections.filter((s) => s.missing)) console.log('  section not found/empty:', s.name, s.selector);
  } finally {
    await browser.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const widths = process.argv.slice(2).length ? process.argv.slice(2).map(Number) : [1440, 991, 390];
  for (const w of widths) await run(w);
}
