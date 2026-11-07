// Services:
//   M35 heading revealed by a sliding mask, light travels down the vertical line (desktop)
//   M36 heading mask on mobile
//   M37 glowing card borders
//   M38 spotlight that follows the mouse over the cards
import { gsap, scrollKeyframes, MQ } from './motion.js';
import { borderLoop } from './glow-loop.js';
import { maskOnView } from './reveal-mask.js';

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
    maskOnView(section, section.querySelector('.shadow.vertical.small'), { from: -50, to: 100, duration: 2, offset: 20 });
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
}
