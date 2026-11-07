// Shared capture helpers: deterministic full-page and per-section screenshots of the site.
// Both sides MUST be captured with these same helpers so screenshots are comparable.
//
// Contract the page under test has to honour (the rebuild should keep these
// selectors or pass its own via `opts`):
//   - the fixed header is `.nav-wrap` (hidden in every tile except the first one)
//   - GSAP is reachable as `window.gsap` (non-scroll tweens are completed before a shot)
//   - lottie instances are reachable via `window.lottie.getRegisteredAnimations()`
//     or `Webflow.require('lottie').lottie` (reference) – the rebuild should expose
//     `window.lottie` (lottie-web default export) for capture purposes.
//   - time-based loops listed in PINS are pinned (CSS !important) to their
//     first keyframe; elements in HIDE (cookie banner) are hidden.

import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { PNG } from 'pngjs';

export const CHROME =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export const VIEWPORTS = {
  1440: { width: 1440, height: 900 },
  991: { width: 991, height: 900 },
  390: { width: 390, height: 844 },
};

// Section list used for per-section screenshots (name -> selector).
export const SECTIONS = [
  ['01-header', 'header.header-new .header-wrapper'],
  ['02-hero', 'section.hero.home'],
  ['03-cards', 'section.bg-dark.cards'],
  ['04-case-heading', '.case--new-heading-wrap:not(._2)'],
  ['05-cases-new', 'section.is-cases-new'],
  ['06-services', 'section.is-cases'],
  ['07-clients', 'section.is-clients'],
  ['08-testimonial', 'section.is-testimonial'],
  ['09-awards', 'section.is-awwards'],
  ['10-blog', 'section.is-blog'],
  ['11-faq', 'section.is-faq'],
  ['12-cta', 'section.is-cta'],
  ['13-footer', 'footer.footer'],
  ['14-book-call-fab', '.contact-book-a-call'],
];

// Pins applied (as !important CSS) after the scroll pass so time-based loops are
// captured in a fixed state. Values = first keyframe of each loop (see spec/motion.md).
export const PINS = [
  // tag-border (a-168): hero tag + services tag border glow
  ['.hero-tag-wrap .stats-card-gradient', 'transform: translate3d(-18%, 2%, 0)'],
  // loopgradient (a-129) on .stats-card-wrapper
  ['.stats-card-wrapper > .stats-card-gradient', 'transform: translate3d(-20vw, 17vw, 0)'],
  // cta-border-rotate (a-134) on .card-glow and .cta-wrap (+ cta-scroll a-127 end state)
  ['.card-glow > .stats-card-gradient', 'transform: translate3d(0%, 0%, 0)'],
  ['.cta-wrap .stats-card-gradient', 'transform: translate3d(0%, 0%, 0)'],
  // service-card-brand-hover (a-42) cross-fade loop, end of first group
  ['.brand-item-img.abs.set-1', 'opacity: 1'],
  ['.brand-item-img.abs.set-2', 'opacity: 0'],
];

// Fixed overlays: visible only in the first full-page tile and in their own section shot.
export const FIXED = '.nav-wrap, .contact-book-a-call';

// Elements removed from captures entirely (third-party cookie banner).
export const HIDE = ['.cookies', '.fs-cc-banner_component'];

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch() {
  return puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: [
      '--hide-scrollbars',
      '--autoplay-policy=no-user-gesture-required',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--force-color-profile=srgb',
      '--font-render-hinting=none',
      '--mute-audio',
    ],
  });
}

// Injected before any page script: a controllable clock. Freezing it stops every
// time-based animation (IX2 timelines, lottie, GSAP tweens, Lenis) while rAF keeps
// ticking, so scroll-driven (time independent) effects still respond to scrolling.
export const CLOCK_SCRIPT = `(() => {
  const perf = performance.now.bind(performance);
  const dateBase = Date.now() - perf();
  let frozen = false, frozenAt = 0, offset = 0;
  const now = () => (frozen ? frozenAt : perf() - offset);
  performance.now = now;
  const RealDate = Date;
  Date.now = () => Math.round(dateBase + now());
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf(() => cb(now()));
  window.__clock = {
    freeze() { if (!frozen) { frozenAt = now(); frozen = true; } },
    unfreeze() { if (frozen) { offset = perf() - frozenAt; frozen = false; } },
    get frozen() { return frozen; },
  };
})();`;

export async function preparePage(browser, width) {
  const vp = VIEWPORTS[width] || { width: Number(width), height: 900 };
  const page = await browser.newPage();
  await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(CLOCK_SCRIPT);
  return { page, vp };
}

/** Wait until two consecutive viewport screenshots are identical (or timeout). */
export async function waitVisualSettle(page, { timeout = 4000, interval = 250 } = {}) {
  const start = Date.now();
  let prev = null;
  while (Date.now() - start < timeout) {
    const buf = await shoot(page);
    if (prev && Buffer.compare(prev, buf) === 0) return true;
    prev = buf;
    await sleep(interval);
  }
  return false;
}

/** Scroll the whole page slowly (real time running) so every scroll/lazy trigger fires. */
export async function scrollPass(page, { step = 0.35, delay = 160 } = {}) {
  const { h, vh } = await page.evaluate(() => ({
    h: document.documentElement.scrollHeight,
    vh: window.innerHeight,
  }));
  for (let y = 0; y <= h; y += Math.round(vh * step)) {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await sleep(delay);
  }
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await sleep(1500);
  // back to the top in a few big steps (scroll direction matters for some scripts)
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(1500);
}

/**
 * Make the page capture-stable (call once, after the scroll pass):
 * videos paused at frame 0, lottie frozen on a fixed frame, CSS animations paused,
 * infinite IX2 loops pinned, cookie banner hidden.
 */
export async function stabilize(page, { pins = PINS, hide = HIDE } = {}) {
  await page.evaluate(async (pins, hide) => {
    await Promise.all(
      [...document.querySelectorAll('video')].map(
        (v) =>
          new Promise((res) => {
            try {
              v.pause();
              v.removeAttribute('autoplay');
              v.autoplay = false;
              v.play = () => Promise.resolve();
              if (v.currentTime === 0) return res();
              v.addEventListener('seeked', () => res(), { once: true });
              v.currentTime = 0;
              setTimeout(res, 3000);
            } catch (e) {
              res();
            }
          }),
      ),
    );
    // lottie: autoplaying (looping) ones -> middle frame, IX/hover driven -> frame 0
    let lot = window.lottie;
    try {
      if (!lot && window.Webflow) lot = window.Webflow.require('lottie').lottie;
    } catch (e) {}
    const anims = (lot && lot.getRegisteredAnimations && lot.getRegisteredAnimations()) || [];
    for (const a of anims) {
      try {
        const frame = a.autoplay ? Math.floor((a.totalFrames - 1) / 2) : 0;
        a.goToAndStop(frame, true);
        const noop = () => {};
        a.play = a.goToAndPlay = a.advanceTime = a.setCurrentRawFrameValue = a.goToAndStop = noop;
      } catch (e) {}
    }
    window.__frozenLotties = anims.length;
    for (const an of document.getAnimations()) {
      if (an.constructor.name === 'CSSAnimation') {
        an.pause();
        an.currentTime = 0;
      }
    }
    const css =
      pins.map(([sel, decl]) => `${sel}{${decl.replace(/;?\s*$/, '')} !important;}`).join('\n') +
      '\n' +
      hide.map((sel) => `${sel}{display:none !important;}`).join('\n') +
      '\n*{caret-color:transparent !important;}';
    const st = document.createElement('style');
    st.id = '__capture_stabilize';
    st.textContent = css;
    document.head.appendChild(st);
  }, pins, hide);
}

/** Viewport screenshot with the page clock frozen (no time-based change mid-capture).
 *  Time-based GSAP tweens (e.g. the mobile IntersectionObserver char reveals) are
 *  jumped to their end first; scroll-scrubbed ones are left alone. Needs window.gsap. */
export async function shoot(page) {
  await page.evaluate(() => {
    const g = window.gsap;
    if (g && g.globalTimeline) {
      // top-level tweens/timelines only: children of a scroll-scrubbed timeline must not be
      // forced to their end state (the snapshot only has top-level tweens, so it is unaffected)
      for (const t of g.globalTimeline.getChildren(false, true, true)) {
        if (!t.scrollTrigger && !(t.vars && t.vars.scrollTrigger) && t.repeat() !== -1) t.progress(1);
      }
    }
    window.__clock && window.__clock.freeze();
  });
  try {
    return await page.screenshot({ type: 'png' });
  } finally {
    await page.evaluate(() => window.__clock && window.__clock.unfreeze());
  }
}

function blit(dst, src, dy, srcY0, rows) {
  for (let r = 0; r < rows; r++) {
    const s = (srcY0 + r) * src.width * 4;
    const d = (dy + r) * dst.width * 4;
    src.data.copy(dst.data, d, s, s + src.width * 4);
  }
}

async function setFixedHidden(page, sel, hidden) {
  if (!sel) return;
  await page.evaluate(
    (sel, hidden) => document.querySelectorAll(sel).forEach((el) => (el.style.visibility = hidden ? 'hidden' : '')),
    sel,
    hidden,
  );
}

async function scrollAndSettle(page, y, settle) {
  await page.evaluate((y) => window.scrollTo(0, y), y);
  await sleep(settle);
}

/**
 * Stitched full-page capture: scroll viewport by viewport (top -> bottom) and stitch.
 * Avoids Puppeteer's fullPage resize, which breaks vh-based layouts.
 */
export async function captureFullPage(page, file, { fixedSelector = FIXED, settle = 900 } = {}) {
  const { h, vh, vw } = await page.evaluate(() => ({
    h: document.documentElement.scrollHeight,
    vh: window.innerHeight,
    vw: window.innerWidth,
  }));
  const out = new PNG({ width: vw, height: h });
  let y = 0;
  let first = true;
  while (y < h) {
    const top = Math.min(y, h - vh);
    await setFixedHidden(page, fixedSelector, !first);
    await scrollAndSettle(page, top, settle);
    const actual = await page.evaluate(() => Math.round(window.scrollY));
    const buf = await shoot(page);
    if (process.env.DEBUG_TILES) fs.writeFileSync(`${file}.tile-${top}-${actual}.png`, buf);
    const tile = PNG.sync.read(buf);
    const srcY0 = y - actual;
    const rows = Math.min(vh - srcY0, h - y);
    if (rows <= 0) break;
    blit(out, tile, y, srcY0, rows);
    y += rows;
    first = false;
  }
  await setFixedHidden(page, fixedSelector, false);
  await scrollAndSettle(page, 0, settle);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, PNG.sync.write(out));
  return { width: vw, height: h };
}

/** Per-section captures: element top aligned to the viewport top, stitched if taller.
 *  Fixed elements (header, floating button) are captured at scrollY = 0. */
export async function captureSections(
  page,
  dir,
  { sections = SECTIONS, fixedSelector = FIXED, settle = 900 } = {},
) {
  fs.mkdirSync(dir, { recursive: true });
  const results = [];
  for (const [name, selector] of sections) {
    const isFixed = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      for (let n = el; n && n !== document.body; n = n.parentElement)
        if (getComputedStyle(n).position === 'fixed') return true;
      return false;
    }, selector);
    if (isFixed === null) {
      results.push({ name, selector, missing: true });
      continue;
    }
    await setFixedHidden(page, fixedSelector, !isFixed);
    if (isFixed) await scrollAndSettle(page, 0, settle);
    const box = await page.evaluate((sel) => {
      const r = document.querySelector(sel).getBoundingClientRect();
      return {
        top: Math.round(r.top + window.scrollY),
        left: Math.max(0, Math.round(r.left)),
        width: Math.round(r.width),
        height: Math.round(r.height),
      };
    }, selector);
    if (box.width === 0 || box.height === 0) {
      results.push({ name, selector, missing: true, empty: true });
      continue;
    }
    const { vh, vw, h } = await page.evaluate(() => ({
      vh: window.innerHeight,
      vw: window.innerWidth,
      h: document.documentElement.scrollHeight,
    }));
    const width = Math.min(box.width, vw - box.left);
    const height = isFixed ? Math.min(box.height, vh - Math.max(0, box.top)) : box.height;
    const out = new PNG({ width, height });
    let done = 0;
    while (done < height) {
      if (!isFixed) await scrollAndSettle(page, Math.min(box.top + done, h - vh), settle);
      const actual = isFixed ? 0 : await page.evaluate(() => Math.round(window.scrollY));
      const tile = PNG.sync.read(await shoot(page));
      const srcY0 = box.top + done - actual;
      const rows = Math.min(vh - srcY0, height - done);
      if (rows <= 0) break;
      for (let r = 0; r < rows; r++) {
        const s = ((srcY0 + r) * tile.width + box.left) * 4;
        tile.data.copy(out.data, (done + r) * width * 4, s, s + width * 4);
      }
      done += rows;
    }
    const file = path.join(dir, `${name}.png`);
    fs.writeFileSync(file, PNG.sync.write(out));
    results.push({ name, selector, file, top: box.top, left: box.left, width, height, fixed: isFixed });
  }
  await setFixedHidden(page, fixedSelector, false);
  await scrollAndSettle(page, 0, settle);
  return results;
}
