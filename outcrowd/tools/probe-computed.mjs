#!/usr/bin/env node
// Dumps resolved geometry + typography of key homepage elements from the reference
// snapshot at each viewport (after a full scroll pass, measured back at scrollY = 0; transforms reflect that state).
// usage: node tools/probe-computed.mjs [1440 991 390]  -> .compare/spec-extract/computed-<w>.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep, scrollPass } from './lib/capture.mjs';
import { openReference } from './reference.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '.compare', 'spec-extract');
fs.mkdirSync(OUT, { recursive: true });

export const PROBES = [
  'body', 'header.header-new .header-wrapper', 'nav.nav-new', '.nav-link-wrap', '.footer-nav-link.nav', '.nav_link-c.contact.grey', '.nav_link-c.contact:not(.grey)', '.btn-text.opacity-90', '.logo-nav', '.burger-wrap', '.burger-line',
  'section.hero.home', '.container.is-big.full', '.hero-tag-wrap', '.tag-text', '.heading-hero', '.show-wrap', '.showreal-home', '.show-real-video', '.lap-top-bg', '.mob-paralax',
  '.hero-paralax.set-1:not(.hide-laptop)', '.hero-paralax.set-2', '.hero-paralax.set-3', '.hero-paralax.set-4:not(.hide-laptop)', '.hero-paralax.set-5', '.hero-paralax.set-6:not(.hide-laptop)', '.hero-paralax.set-7:not(.hide-laptop)', 'img.light',
  'section.bg-dark.cards', '.anim-heading-home', '.hero-cards', '.stats-card-wrapper.img-list-set-1', '.stats-card-wrapper.set-3', '.stats-card-wrapper.set-2', '.stats-card-wrapper.set-4', '.card-hero-heading', '.card-hero-desc', '.left-stat-gradient.top',
  '.case--new-heading-wrap', '.case-heading', '.b1.max-w-37-5',
  'section.is-cases-new', '.height-cases', '.cases-sticky-wrap', '.cards-cases', '.cards-cases-left', '.cards-cases-right', '.cases-cards-left-item-heading', '.cases-cards-left-item-text', '.rotate-ellipse-2', '.rotate-card-2.card-2', '.case-mob-wrap', '.card-case-bot-item-heading',
  'section.is-cases', '.section-name', '.b1.serv-sub.max-w-40', '.hero-tag-wrap.serv', '.verticle-line', '.b1.serv-sub.second', '#cards', '.service-card.set-1', '.service-card.set-4', '.service-card.set-2', '.service-card.set-5', '.service-card.set-3', '.service-card.set-6', '.service-card-title', '.service-card-desc',
  'section.is-clients', '.brands-heading', '.big-brands-wrap', '.big-brand-card', '.startups', '.heading-3.max-w-82.color-black', '.startup-list.home', '.startup-list-item', '.startup-name', '.startup-desc', '.btn-secondary.m-2-3', '.btn-icon-wrap',
  'section.is-testimonial', '.heading-7.text-align-center', '.first-line-testimoniall .heading-2', '.heading-wrap-testimoniall', '.icon-clutch-full', '.swiper', '.swiper-slide', '.body-b2', '.body-b4.dark-black-500', '.raiting-data', '.rate', '.heading-5.max-w-380', '.btn-secondary.clutch',
  'section.is-awwards', '.is-awwards .heading-2', '.awards-list', '.awards-list-item', '.awards-list-item .heading-5', '.awards-desc-1', '.awards-desc-2', '.awards-date', '.awards-img',
  'section.is-blog', '.is-blog .heading-2', '.collection-news-wrap', '.featured-img-wrap', '.feature-img', '.blog-news-home-img', '.haeding-blog', '.btn-secondary.news',
  'section.is-faq', '.is-faq .heading-3', '.faq-wrap', '.faq-dropdown', '.dropdown-toggle', '.faq-question-label', '.faq-answer-p',
  'section.is-cta', '.cta-card-wrapper', '.cta-card', '.cta-heading', '.b1.grey.text-ailng-left.max-w-29', '.nav_link-cta.orange', '.nav_link-cta.violet', '.cta-img',
  '.contact-book-a-call', '.btn-book-text',
  'footer.footer', '.footer-main', '.footer-col', '.footer-nav-link.white', '.footer-col .footer-nav-link:not(.white):not(.hover)', '.email-link', '.social-footer-wrap', '.footer-bot', '.copy',
];

const PROPS = ['display', 'position', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color', 'backgroundColor', 'backgroundImage', 'borderRadius', 'border', 'padding', 'margin', 'gap', 'gridTemplateColumns', 'flexDirection', 'justifyContent', 'alignItems', 'opacity', 'transform', 'zIndex', 'boxShadow', 'textAlign', 'maxWidth', 'objectFit', 'overflow'];

const widths = process.argv.slice(2).length ? process.argv.slice(2).map(Number) : [1440, 991, 390];
const browser = await launch();
try {
  for (const w of widths) {
    const { page } = await openReference(browser, w);
    await sleep(4500);
    await page.evaluate(() => (document.getElementById('preloader').style.display = 'none'));
    await scrollPass(page); // load lazy images so lower sections have their final geometry
    const res = await page.evaluate(
      (probes, props) => {
        const defaults = {};
        const out = { rootFontSize: getComputedStyle(document.documentElement).fontSize, vw: innerWidth, vh: innerHeight, pageHeight: document.documentElement.scrollHeight, elements: {} };
        for (const sel of probes) {
          const el = document.querySelector(sel);
          if (!el) {
            out.elements[sel] = null;
            continue;
          }
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          const o = { count: document.querySelectorAll(sel).length, rect: [r.x, r.y + scrollY, r.width, r.height].map((v) => Math.round(v * 10) / 10) };
          for (const p of props) {
            const v = cs[p];
            if (v && !['none', 'normal', '0px', 'auto', 'rgba(0, 0, 0, 0)', 'visible', 'static'].includes(v)) o[p] = v;
          }
          if (cs.display === 'none') o.display = 'none';
          out.elements[sel] = o;
        }
        return out;
      },
      PROBES,
      PROPS,
    );
    fs.writeFileSync(path.join(OUT, `computed-${w}.json`), JSON.stringify(res, null, 1));
    console.log(`[${w}] root font-size ${res.rootFontSize}, page height ${res.pageHeight}`);
    await page.close();
  }
} finally {
  await browser.close();
}
