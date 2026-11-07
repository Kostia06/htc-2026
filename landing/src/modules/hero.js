// Hero interactions:
//   M17 glowing border loop on the "Digital brand design agency" tag
//   M18 desktop scroll choreography (heading + widgets fly up, showreel frame dissolves)
//   M19 showreel grows from 48% to full width while scrolling
//   M20 mobile widget parallax
import { gsap, scrollKeyframes, loop, onceInView, vw, rem, MQ } from './motion.js';

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

  const set = (n) => `.hero-paralax.set-${n}`;
  const mm = gsap.matchMedia();

  // M18
  mm.add(MQ.desktop, () => {
    const start = [1, 2, 3, 4, 5, 6, 7].map((n) => [set(n), 29, { y: vw(0) }]);
    scrollKeyframes(section, [
      ...start,
      ['.hero-heading', 29, { y: vw(0) }],
      ['.show-wrap', 29, { y: rem(0) }],
      ['.show-real-video', 43, { width: '97.5%', height: '97.5%' }],
      ['.lap-top-bg', 43, { opacity: 1 }],
      ['.show-real-video', 45.5, { width: '100%', height: '100%' }],
      ['.lap-top-bg', 45.5, { opacity: 0 }],
      ['.hero-heading', 50, { y: vw(-30) }],
      ['.show-wrap', 50, { y: rem(-34.5) }],
      [set(1), 53, { y: vw(-51) }],
      [set(2), 53, { y: vw(-63) }],
      [set(3), 53, { y: vw(-62) }],
      [set(7), 54, { y: vw(-70) }],
      [set(4), 54, { y: vw(-57) }],
      [set(6), 54, { y: vw(-60) }],
      [set(5), 54, { y: vw(-59) }],
    ]);
  });

  // M20
  mm.add(MQ.mobile, () => {
    const end = { 1: -20, 2: -25, 3: -15, 7: -25, 4: -25, 6: -26, 5: -19 };
    scrollKeyframes(section, [
      ...Object.keys(end).map((n) => [set(n), 53, { y: vw(0) }]),
      ...Object.entries(end).map(([n, v]) => [set(n), 85, { y: vw(v) }]),
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
