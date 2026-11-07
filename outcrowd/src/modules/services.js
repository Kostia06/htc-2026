// Services:
//   M35 heading revealed by a sliding mask, light travels down the vertical line (desktop)
//   M36 heading mask on mobile
//   M37 glowing card borders
//   M38 spotlight that follows the mouse over the cards
//   M39 card lotties played in loops once visible
//   M40 Brand Visual logos cross-fade to their coloured versions
import { gsap, scrollKeyframes, onceInView, MQ, EASE } from './motion.js';
import { getLottie, lottieLoop } from './lottie.js';
import { borderLoop } from './glow-loop.js';

const LOTTIE_LOOPS = [
  // [card selector, lottie selector, steps]
  ['.service-card.set-1', '.brand-lottie', [[100, 6.23], [0, 0, 0.3], [100, 6.23], [0, 0, 0.3]]],
  ['.service-card.set-2', '.platform-lottie', [[100, 2.57], [0, 0, 0.3], [100, 2.57], [0, 0]]],
  ['.service-card.set-5', '.web-lottie', [[100, 4.47], [0, 0], [100, 4.47], [0, 0]]],
  ['.service-card.set-6', '.brand-lottie._2', [[93, 3.47], [0, 0], [97, 3.47], [0, 0]]],
];

export function initServices() {
  const section = document.querySelector('.section.is-cases');
  if (!section) return;
  const mm = gsap.matchMedia();

  // M35
  mm.add(MQ.desktop, () => {
    const fading = ['.section-name', '.b1.serv-sub.max-w-40', '.hero-tag-wrap.serv'];
    scrollKeyframes(section, [
      ['.shadow', 12, { yPercent: -49 }],
      ['.b1.serv-sub.second', 12, { opacity: 0 }],
      ...fading.map((t) => [t, 12, { opacity: 0 }]),
      ['.stats-card-gradient.services.line', 18, { x: 0, xPercent: -50, yPercent: -100 }],
      ...fading.map((t) => [t, 20, { opacity: 1 }]),
      ['.b1.serv-sub.second', 23, { opacity: 0 }],
      ['.shadow', 23, { yPercent: 38 }],
      ['.stats-card-gradient.services.line', 24, { yPercent: 0 }],
      ['.b1.serv-sub.second', 35, { opacity: 1 }],
    ]);
  });

  // M36
  mm.add(MQ.mobile, () => {
    const mask = section.querySelector('.shadow.vertical.small');
    gsap.set(mask, { yPercent: -50 });
    onceInView(section, () => gsap.to(mask, { yPercent: 100, duration: 2, ease: 'none' }), 20);
  });

  // M37
  for (const card of section.querySelectorAll('.card-glow')) borderLoop(card);

  // M38
  const grid = section.querySelector('#cards');
  const cards = section.querySelectorAll('.service-card');
  grid?.addEventListener('mousemove', (e) => {
    for (const card of cards) {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mouse-x', `${e.clientX - r.left}px`);
      card.style.setProperty('--mouse-y', `${e.clientY - r.top}px`);
    }
  });

  // M39
  for (const [cardSel, lottieSel, steps] of LOTTIE_LOOPS) {
    const card = section.querySelector(cardSel);
    const anim = getLottie(card?.querySelector(lottieSel));
    if (!anim) continue;
    const tl = lottieLoop(anim, steps, gsap);
    onceInView(card, () => tl.play());
  }

  // M40
  const brand = section.querySelector('.service-card.set-4');
  if (brand) {
    const a = brand.querySelectorAll('.brand-item-img.abs.set-1');
    const b = brand.querySelectorAll('.brand-item-img.abs.set-2');
    const ease = EASE.ease;
    const tl = gsap.timeline({ repeat: -1, paused: true });
    tl.to(a, { opacity: 1, duration: 1.2, delay: 0.7, ease }, 0)
      .to(b, { opacity: 0, duration: 1, delay: 0.7, ease }, 0)
      .to(b, { opacity: 1, duration: 1.2, delay: 0.7, ease }, 1.9)
      .to(a, { opacity: 0, duration: 1, delay: 0.7, ease }, 1.9);
    onceInView(brand, () => tl.play());
  }
}
