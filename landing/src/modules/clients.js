// Clients:
//   M42 enterprise logo cards scale in one after another while scrolling (≥480px)
//   M43 …or each pops in when visible (≤479px)
//   M44 heading mask on mobile
//   M45 statement fade on mobile (the char reveal itself is modules/split-reveal.js)
import { gsap, scrollKeyframes, onceInView, MQ, EASE } from './motion.js';
import { maskOnView } from './reveal-mask.js';

export function initClients() {
  const section = document.querySelector('.section.is-clients');
  if (!section) return;
  const [mcd, toyota] = section.querySelectorAll('.big-brands-top-grid .big-brand-card');
  const [redbull, dolby, ibm] = section.querySelectorAll('.big-brands-down-grid .big-brand-card');
  const mm = gsap.matchMedia();
  const e = EASE.easeInOut;

  mm.add('(min-width: 480px)', () => {
    scrollKeyframes(section, [
      [[mcd, toyota], 5, { scale: 0.5 }, e],
      [[redbull, dolby, ibm], 10, { scale: 0.5 }, e],
      [mcd, 20, { scale: 1 }, e],
      [toyota, 25, { scale: 1 }, e],
      [redbull, 30, { scale: 1 }, e],
      [dolby, 35, { scale: 1 }, e],
      [ibm, 40, { scale: 1 }, e],
    ]);
  });

  mm.add(MQ.tiny, () => {
    for (const card of [mcd, toyota, redbull, dolby, ibm]) {
      gsap.set(card, { scale: 0.2 });
      onceInView(card, () => gsap.to(card, { scale: 1, duration: 2, ease: EASE.outExpo }));
    }
  });

  mm.add(MQ.mobile, () => {
    maskOnView(section, section.querySelector('.shadow.white.vert'), { from: -60, to: 100, duration: 2, offset: 30 });

    const startups = section.querySelector('.startups');
    const statement = startups.querySelector('.heading-3.max-w-82.color-black');
    gsap.set(statement, { opacity: 0 });
    onceInView(startups, () => gsap.to(statement, { opacity: 1, duration: 1.3, ease: EASE.ease }), 20);
  });
}
