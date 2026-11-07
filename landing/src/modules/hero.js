// Hero interactions:
//   M17 glowing border loop on the "Digital brand design agency" tag
//   M18 desktop scroll choreography (heading + messages fly up, screen frame dissolves)
//   M19 screen frame grows from 48% to full width while scrolling
//   M20 mobile message parallax
//   pop-in of the floating messages once the preloader has lifted
import { gsap, scrollKeyframes, loop, onceInView, vw, rem, MQ } from './motion.js';

// how far each message rises while the hero scrolls away (vw, desktop / mobile), varied for depth
const RISE = [-52, -63, -58, -66, -55, -70, -54, -62, -59, -68, -57];
const RISE_MOB = [-20, -25, -15, -22, -26, -19, -24, -18, -23, -21, -25];

function popIn(section) {
  const pops = section.querySelectorAll('.r-w__pop');
  if (!pops.length) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const play = () =>
    reduce
      ? gsap.set(pops, { opacity: 1, scale: 1 })
      : gsap.to(pops, { opacity: 1, scale: 1, duration: 0.55, ease: 'back.out(2.2)', stagger: { each: 0.09, from: 'random' } });
  if (window.__preloaderDone) play();
  else document.addEventListener('preloader:done', play, { once: true });
}


/** Phones: start the message band just under the hero buttons (heading height varies with width). */
function placeMobileMessages(section) {
  const band = section.querySelector('.r-widgets');
  const btns = section.querySelector('.r-hero-btns');
  const box = section.querySelector('.container.is-big.full');
  if (!band || !btns || !box) return;
  const place = () => {
    if (window.innerWidth > 767) {
      band.style.top = '';
      return;
    }
    const gap = 12;
    band.style.top = `${btns.offsetTop + btns.offsetHeight + gap + offsetWithin(btns.offsetParent, box)}px`;
  };
  place();
  window.addEventListener('resize', place);
  document.fonts?.ready.then(place);
}

/** Vertical offset of el's top inside ancestor, summed over offsetParents. */
function offsetWithin(el, ancestor) {
  let y = 0;
  while (el && el !== ancestor) {
    y += el.offsetTop;
    el = el.offsetParent;
  }
  return y;
}

export function initHero() {
  const section = document.querySelector('.section.hero.home');
  if (!section) return;

  // M17
  const tagWrap = section.querySelector('.hero-tag-wrap');
  const tagGlow = loop(tagWrap.querySelector('.stats-card-gradient'), [
    [{ xPercent: -18, yPercent: 2 }, 0.5],
    [{ xPercent: 109, yPercent: 2 }, 1.5],
    [{ xPercent: 160, yPercent: 73 }, 0.5],
    [{ xPercent: -3, yPercent: 73 }, 2],
    [{ xPercent: -18, yPercent: 2 }, 1],
  ]);
  onceInView(tagWrap, () => tagGlow.play());

  popIn(section);
  placeMobileMessages(section);

  const msgs = [...section.querySelectorAll('.r-w')];
  const mm = gsap.matchMedia();

  // M18
  mm.add(MQ.desktop, () => {
    scrollKeyframes(section, [
      ...msgs.map((m) => [m, 29, { y: vw(0) }]),
      ['.hero-heading', 29, { y: vw(0) }],
      ['.show-wrap', 29, { y: rem(0) }],
      ['.show-real-video', 43, { width: '97.5%', height: '97.5%' }],
      ['.lap-top-bg', 43, { opacity: 1 }],
      ['.show-real-video', 45.5, { width: '100%', height: '100%' }],
      ['.lap-top-bg', 45.5, { opacity: 0 }],
      ['.hero-heading', 50, { y: vw(-30) }],
      ['.show-wrap', 50, { y: rem(-34.5) }],
      ...msgs.map((m, i) => [m, 53 + (i % 2), { y: vw(RISE[i % RISE.length]) }]),
    ]);
  });

  // M20
  mm.add(MQ.mobile, () => {
    scrollKeyframes(section, [
      ...msgs.map((m) => [m, 53, { y: vw(0) }]),
      ...msgs.map((m, i) => [m, 85, { y: vw(RISE_MOB[i % RISE_MOB.length]) }]),
    ]);
  });

  // M19
  const frame = section.querySelector('.showreal-home');
  const video = section.querySelector('.show-real-video');
  const bezel = section.querySelector('.lap-top-bg');
  const grow = () => {
    if (window.innerWidth <= 767) return;
    const f = window.scrollY / section.offsetHeight;
    const from = window.innerWidth >= 1921 ? 60 : 48;
    const t = Math.min(Math.max((f - 0.2) / 0.13, 0), 1);
    frame.style.width = `${from + (100 - from) * t}%`;
    frame.style.borderRadius = `${1.7 * (1 - t)}vw`;
    bezel.style.borderRadius = `${1.7 * (1 - t)}vw`;
    video.style.borderRadius = `${1.2 * (1 - t)}vw`;
  };
  document.addEventListener('scroll', grow, { passive: true });
}
